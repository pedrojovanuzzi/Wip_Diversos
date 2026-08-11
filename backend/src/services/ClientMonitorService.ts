import { Client } from "ssh2";
import { LessThanOrEqual } from "typeorm";
import dotenv from "dotenv";
import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { ClientMonitor } from "../entities/ClientMonitor";
import { ClientMonitorEvent } from "../entities/ClientMonitorEvent";
import { Radacct } from "../entities/Radacct";

dotenv.config();

const servidores = [
  { host: process.env.MIKROTIK_PPPOE1, nome: "PPPOE1" },
  { host: process.env.MIKROTIK_PPPOE2, nome: "PPPOE2" },
  { host: process.env.MIKROTIK_PPPOE3, nome: "PPPOE3" },
  { host: process.env.MIKROTIK_PPPOE4, nome: "PPPOE4" },
];

const INTERVALO_PADRAO = 60; // segundos
const INTERVALO_MINIMO = 30;
const HORAS_MAXIMAS = 72;
const TICK = 10_000; // resolução do agendador

type Estado = {
  online: boolean;
  servidor: string | null;
  ip: string | null;
  callerId: string | null;
  uptime: string | null;
};

// Executa um comando no Mikrotik via SSH e devolve a saída bruta.
function executarSSH(host: string, comando: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = "";

    conn
      .on("ready", () => {
        conn.exec(comando, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          stream
            .on("close", () => {
              conn.end();
              resolve(output);
            })
            .on("data", (data: Buffer) => {
              output += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              output += data.toString();
            });
        });
      })
      .on("error", (err) => reject(err))
      .connect({
        host,
        port: 2004,
        username: process.env.MIKROTIK_LOGIN!,
        password: process.env.MIKROTIK_PASSWORD!,
        readyTimeout: 5000,
      });
  });
}

class ClientMonitorService {
  // Monitores em execução: id -> timestamp da última coleta
  private emExecucao = new Map<number, number>();
  private tickTimer: NodeJS.Timeout | null = null;
  private iniciado = false;

  // Sobe o agendador. O primeiro tick só roda depois que o DataSource
  // termina de inicializar, e é ele quem retoma/expira os monitores
  // que ficaram ativos antes do restart.
  start = async () => {
    if (this.iniciado) return;
    this.iniciado = true;

    this.tickTimer = setInterval(() => {
      this.tick().catch((error) =>
        console.error("[ClientMonitorService] Erro no tick:", error),
      );
    }, TICK);
    this.tickTimer.unref?.();
  };

  stop = () => {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.iniciado = false;
  };

  private get monitorRepo() {
    return AppDataSource.getRepository(ClientMonitor);
  }

  private get eventoRepo() {
    return AppDataSource.getRepository(ClientMonitorEvent);
  }

  // Cria (ou reaproveita) um monitoramento para o cliente.
  criar = async (
    pppoe: string,
    horas: number,
    criadoPor?: string | null,
    intervalo?: number,
  ): Promise<ClientMonitor> => {
    const login = String(pppoe || "").trim();
    if (!login) throw new Error("PPPoE não informado");

    const janela = Math.min(Math.max(Number(horas) || 1, 1), HORAS_MAXIMAS);
    const passo = Math.max(
      Number(intervalo) || INTERVALO_PADRAO,
      INTERVALO_MINIMO,
    );

    // Já existe um monitoramento ativo para esse cliente? Apenas estende.
    const ativo = await this.monitorRepo.findOne({
      where: { pppoe: login, status: "ativo" },
      order: { id: "DESC" },
    });

    const agora = new Date();

    if (ativo && ativo.expira_em > agora) {
      ativo.horas = janela;
      ativo.expira_em = new Date(agora.getTime() + janela * 3600_000);
      await this.monitorRepo.save(ativo);
      await this.registrar(ativo, {
        tipo: "inicio",
        mensagem: `Janela de monitoramento estendida para ${janela}h`,
      });
      return ativo;
    }

    const monitor = this.monitorRepo.create({
      pppoe: login,
      horas: janela,
      intervalo: passo,
      status: "ativo",
      iniciado_em: agora,
      expira_em: new Date(agora.getTime() + janela * 3600_000),
      criado_por: criadoPor ?? null,
    });
    await this.monitorRepo.save(monitor);

    await this.registrar(monitor, {
      tipo: "inicio",
      mensagem: `Monitoramento iniciado por ${janela}h (coleta a cada ${passo}s)`,
    });

    // Primeira coleta imediata, para a página já abrir com informação.
    this.coletar(monitor).catch((error) =>
      console.error("[ClientMonitorService] Erro na coleta inicial:", error),
    );

    this.start();
    return monitor;
  };

  encerrar = async (id: number): Promise<ClientMonitor | null> => {
    const monitor = await this.monitorRepo.findOne({ where: { id } });
    if (!monitor || monitor.status !== "ativo") return monitor;

    monitor.status = "cancelado";
    monitor.finalizado_em = new Date();
    await this.monitorRepo.save(monitor);
    this.emExecucao.delete(monitor.id);

    await this.registrar(monitor, {
      tipo: "fim",
      mensagem: "Monitoramento encerrado manualmente",
    });
    return monitor;
  };

  listar = async (limite = 30): Promise<ClientMonitor[]> => {
    return this.monitorRepo.find({
      order: { id: "DESC" },
      take: Math.min(Math.max(limite, 1), 100),
    });
  };

  buscar = async (id: number) => {
    return this.monitorRepo.findOne({ where: { id } });
  };

  eventos = async (
    monitorId: number,
    opcoes: { apenasMudancas?: boolean; limite?: number } = {},
  ) => {
    const qb = this.eventoRepo
      .createQueryBuilder("e")
      .where("e.monitor_id = :id", { id: monitorId });

    if (opcoes.apenasMudancas) qb.andWhere("e.mudanca = true");

    return qb
      .orderBy("e.id", "DESC")
      .take(Math.min(Math.max(opcoes.limite || 500, 1), 2000))
      .getMany();
  };

  // Marca como finalizado tudo que já passou da janela.
  private expirarVencidos = async () => {
    const vencidos = await this.monitorRepo.find({
      where: { status: "ativo", expira_em: LessThanOrEqual(new Date()) },
    });

    for (const monitor of vencidos) {
      monitor.status = "finalizado";
      monitor.finalizado_em = new Date();
      await this.monitorRepo.save(monitor);
      this.emExecucao.delete(monitor.id);
      await this.registrar(monitor, {
        tipo: "fim",
        mensagem: "Janela de monitoramento encerrada",
      });
    }
  };

  private tick = async () => {
    if (!AppDataSource.isInitialized) return;

    await this.expirarVencidos();

    const ativos = await this.monitorRepo.find({ where: { status: "ativo" } });
    const agora = Date.now();

    for (const monitor of ativos) {
      const ultima = this.emExecucao.get(monitor.id);
      if (ultima === -1) continue; // coleta em andamento
      const referencia =
        ultima ?? monitor.ultima_verificacao?.getTime() ?? 0;
      if (agora - referencia < monitor.intervalo * 1000) continue;

      this.emExecucao.set(monitor.id, -1);
      this.coletar(monitor)
        .catch((error) =>
          console.error(
            `[ClientMonitorService] Erro ao coletar monitor ${monitor.id}:`,
            error,
          ),
        )
        .finally(() => this.emExecucao.set(monitor.id, Date.now()));
    }
  };

  // Uma coleta: consulta o PPP ativo nos concentradores e grava o resultado.
  private coletar = async (monitor: ClientMonitor) => {
    let estado: Estado;
    try {
      estado = await this.consultarEstado(monitor.pppoe);
    } catch (error: any) {
      await this.registrar(monitor, {
        tipo: "erro",
        mensagem: `Falha ao consultar concentradores: ${error?.message || error}`,
      });
      await this.monitorRepo.update(monitor.id, {
        ultima_verificacao: new Date(),
      });
      return;
    }

    const anterior = await this.eventoRepo.findOne({
      where: { monitor_id: monitor.id },
      order: { id: "DESC" },
    });
    const estadoAnterior =
      anterior && (anterior.tipo === "online" || anterior.tipo === "conectado")
        ? true
        : anterior &&
            (anterior.tipo === "offline" || anterior.tipo === "desconectado")
          ? false
          : null;

    const mudanca = estadoAnterior !== null && estadoAnterior !== estado.online;
    const consumo = await this.consumoSessao(monitor.pppoe);

    await this.registrar(monitor, {
      tipo: mudanca
        ? estado.online
          ? "conectado"
          : "desconectado"
        : estado.online
          ? "online"
          : "offline",
      mudanca,
      servidor: estado.servidor,
      ip: estado.ip,
      callerId: estado.callerId,
      uptime: estado.uptime,
      download: consumo?.download ?? null,
      upload: consumo?.upload ?? null,
      mensagem: estado.online
        ? mudanca
          ? "Cliente reconectou"
          : "Sessão PPPoE ativa"
        : mudanca
          ? "Cliente caiu"
          : "Sem sessão PPPoE ativa",
    });

    await this.monitorRepo.update(monitor.id, {
      ultima_verificacao: new Date(),
    });
  };

  // Procura a sessão PPPoE ativa do cliente nos concentradores.
  private consultarEstado = async (pppoe: string): Promise<Estado> => {
    const estado: Estado = {
      online: false,
      servidor: null,
      ip: null,
      callerId: null,
      uptime: null,
    };

    let erros = 0;
    for (const servidor of servidores) {
      if (!servidor.host) continue;
      try {
        const resposta = await executarSSH(
          servidor.host,
          `/ppp active print without-paging detail where name="${pppoe}"`,
        );

        const match =
          /name="([^"]+)"\s+service=pppoe\s+caller-id="([0-9A-Fa-f:]+)"\s+address=([\d.]+)\s+uptime=(\S+)/i.exec(
            resposta,
          );

        if (match) {
          estado.online = true;
          estado.servidor = servidor.nome;
          estado.callerId = match[2];
          estado.ip = match[3];
          estado.uptime = match[4];
          return estado;
        }

        // Sem detalhe casado, mas com IP na saída: ainda conta como ativo.
        const ip = /address=([\d.]+)/i.exec(resposta);
        if (ip) {
          estado.online = true;
          estado.servidor = servidor.nome;
          estado.ip = ip[1];
          return estado;
        }
      } catch {
        erros += 1;
      }
    }

    const alcancaveis = servidores.filter((s) => s.host).length;
    if (alcancaveis > 0 && erros === alcancaveis) {
      throw new Error("Nenhum concentrador respondeu");
    }

    return estado;
  };

  // Consumo acumulado da sessão corrente do cliente (radacct).
  private consumoSessao = async (pppoe: string) => {
    try {
      if (!MkauthSource.isInitialized) return null;
      const sessao = await MkauthSource.getRepository(Radacct).findOne({
        where: { username: pppoe },
        order: { radacctid: "DESC" },
      });
      if (!sessao) return null;
      return {
        download: Number(sessao.acctoutputoctets) || 0,
        upload: Number(sessao.acctinputoctets) || 0,
      };
    } catch {
      return null;
    }
  };

  private registrar = async (
    monitor: ClientMonitor,
    dados: {
      tipo: string;
      mudanca?: boolean;
      servidor?: string | null;
      ip?: string | null;
      callerId?: string | null;
      uptime?: string | null;
      download?: number | null;
      upload?: number | null;
      mensagem?: string | null;
    },
  ) => {
    const evento = this.eventoRepo.create({
      monitor_id: monitor.id,
      pppoe: monitor.pppoe,
      tipo: dados.tipo,
      mudanca: dados.mudanca ?? false,
      servidor: dados.servidor ?? null,
      ip: dados.ip ?? null,
      caller_id: dados.callerId ?? null,
      uptime: dados.uptime ?? null,
      download: dados.download ?? null,
      upload: dados.upload ?? null,
      mensagem: dados.mensagem ?? null,
    });
    await this.eventoRepo.save(evento);
    return evento;
  };
}

export default new ClientMonitorService();
