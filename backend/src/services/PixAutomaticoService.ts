import EfiPay from "sdk-node-apis-efi";
import path from "path";
import dotenv from "dotenv";
import { Between, IsNull, Not } from "typeorm";

import LocalDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { Faturas } from "../entities/Faturas";
import { ClientesEntities } from "../entities/ClientesEntities";
import { PixAutomaticoCobranca } from "../entities/PixAutomaticoCobranca";
import { PixAutomaticoNotificacao } from "../entities/PixAutomaticoNotificacao";

dotenv.config();

const isSandbox = process.env.SERVIDOR_HOMOLOGACAO === "true";

const options = {
  sandbox: isSandbox,
  client_id: isSandbox
    ? process.env.CLIENT_ID_HOMOLOGACAO!
    : process.env.CLIENT_ID!,
  client_secret: isSandbox
    ? process.env.CLIENT_SECRET_HOMOLOGACAO!
    : process.env.CLIENT_SECRET!,
  certificate: isSandbox
    ? path.resolve("src", "files", process.env.CERTIFICATE_SANDBOX!)
    : path.resolve("dist", "files", process.env.CERTIFICATE_PROD!),
  validateMtls: false,
};

/** Data no formato que a Efí exige: AAAA-MM-DDTHH:MM:SSZ, sem milissegundos. */
function formatoEfi(data: Date): string {
  return data.toISOString().split(".")[0] + "Z";
}

function primeiroDiaDoMes(referencia = new Date()) {
  return new Date(referencia.getFullYear(), referencia.getMonth(), 1);
}

function ultimoDiaDoMes(referencia = new Date()) {
  return new Date(
    referencia.getFullYear(),
    referencia.getMonth() + 1,
    0,
    23,
    59,
    59,
  );
}

export interface ResumoConciliacao {
  periodo: { inicio: string; fim: string };
  cobrancas: number;
  pagas: number;
  baixadas: number;
  jaBaixadas: number;
  semPagamento: number;
  erros: { txid: string; erro: string }[];
}

export interface ResumoGeracao {
  recorrencias: number;
  criadas: number;
  jaExistiam: number;
  semMensalidade: number;
  erros: { idRec: string; erro: string }[];
}

/**
 * Pix Automático: geração das cobranças do mês, conferência com a Efí e
 * processamento das notificações.
 *
 * O ponto central é não depender do webhook. A Efí tenta entregar a
 * notificação 9 vezes ao longo de cerca de 5 horas e depois desiste, e o
 * reenvio manual dela não vale para o Pix Automático. Por isso a conferência
 * diária lê as cobranças direto na Efí e dá baixa no que estiver pago.
 */
class PixAutomaticoService {
  private cobrancaRepo = LocalDataSource.getRepository(PixAutomaticoCobranca);
  private notificacaoRepo = LocalDataSource.getRepository(
    PixAutomaticoNotificacao,
  );
  private faturaRepo = MkauthSource.getRepository(Faturas);
  private clienteRepo = MkauthSource.getRepository(ClientesEntities);

  /** Login do cliente por recorrência, para não consultar a Efí repetidas vezes. */
  private loginPorRec = new Map<string, string>();

  private efi() {
    return new EfiPay(options);
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------

  /** Grava a notificação como chegou, antes de qualquer processamento. */
  async registrarNotificacao(origem: "cobr" | "rec", payload: unknown) {
    const notificacao = this.notificacaoRepo.create({
      origem,
      payload: JSON.stringify(payload ?? {}),
      processada: false,
    });
    return this.notificacaoRepo.save(notificacao);
  }

  /**
   * Processa uma notificação já gravada. Cada cobrança citada é reconferida na
   * Efí: a notificação diz que algo mudou, não que foi paga.
   */
  async processarNotificacao(notificacao: PixAutomaticoNotificacao) {
    try {
      const corpo = JSON.parse(notificacao.payload || "{}");
      const cobrancas: any[] = Array.isArray(corpo?.cobsr) ? corpo.cobsr : [];

      for (const cobranca of cobrancas) {
        if (cobranca?.txid) await this.sincronizarCobranca(cobranca.txid);
      }

      // A notificação de recorrência não traz cobrança; serve para acompanhar
      // a autorização, e o estado dela é sempre lido da Efí quando precisa.
      notificacao.processada = true;
      notificacao.erro = null;
    } catch (erro: any) {
      notificacao.processada = false;
      notificacao.erro = String(erro?.message || erro).slice(0, 2000);
      console.error(
        "❌ Falha ao processar notificação do Pix Automático:",
        erro,
      );
    }
    await this.notificacaoRepo.save(notificacao);
    return notificacao;
  }

  /** Reprocessa o que ficou para trás (erro no meio, banco fora do ar). */
  async processarNotificacoesPendentes(limite = 50) {
    const pendentes = await this.notificacaoRepo.find({
      where: { processada: false },
      order: { id: "ASC" },
      take: limite,
    });
    for (const pendente of pendentes) await this.processarNotificacao(pendente);
    return pendentes.length;
  }

  // -------------------------------------------------------------------------
  // Conferência
  // -------------------------------------------------------------------------

  /**
   * Lê uma cobrança na Efí, atualiza o espelho local e dá baixa na mensalidade
   * se o dinheiro entrou e a baixa ainda não foi feita.
   */
  async sincronizarCobranca(txid: string) {
    const efipay = this.efi();
    const cobranca = await efipay.pixDetailAutomaticCharge({ txid });

    let registro = await this.cobrancaRepo.findOne({ where: { txid } });
    if (!registro) {
      registro = this.cobrancaRepo.create({ txid, idRec: cobranca?.idRec });
    }

    registro.idRec = cobranca?.idRec ?? registro.idRec;
    registro.status = cobranca?.status ?? registro.status;
    registro.valor = cobranca?.valor?.original ?? registro.valor;
    registro.vencimento =
      cobranca?.calendario?.dataDeVencimento ?? registro.vencimento;
    registro.login =
      registro.login || (await this.loginDaRecorrencia(registro.idRec));

    const pagamento = await this.confirmarPagamento(cobranca);
    if (pagamento) {
      registro.endToEndId = pagamento.endToEndId;
      registro.valorPago = pagamento.valor;
      registro.pagoEm = pagamento.horario;
    }

    // A baixa só acontece uma vez por cobrança.
    if (pagamento && !registro.baixadoEm) {
      try {
        const fatura = await this.darBaixaNaMensalidade(registro, pagamento);
        if (fatura) {
          registro.tituloFatura = fatura;
          registro.baixadoEm = new Date();
          registro.erro = null;
        } else {
          registro.erro = "Mensalidade correspondente não encontrada.";
        }
      } catch (erro: any) {
        registro.erro = String(erro?.message || erro).slice(0, 2000);
      }
    }

    await this.cobrancaRepo.save(registro);
    return registro;
  }

  /**
   * O dinheiro entrou?
   *
   * O status da cobrança sozinho não diz isso: a Efí notifica em toda mudança,
   * inclusive criação e falha. A confirmação vem do Pix recebido — cada
   * tentativa liquidada tem um endToEndId, e ele precisa existir como Pix
   * recebido na conta.
   */
  private async confirmarPagamento(cobranca: any): Promise<{
    endToEndId: string;
    valor: string;
    horario: Date;
  } | null> {
    const tentativas: any[] = Array.isArray(cobranca?.tentativas)
      ? cobranca.tentativas
      : [];

    const efipay = this.efi();

    for (const tentativa of tentativas) {
      const e2e = tentativa?.endToEndId;
      if (!e2e) continue;
      try {
        const pix = await efipay.pixDetailReceived({ e2eId: e2e });
        if (pix?.valor) {
          return {
            endToEndId: e2e,
            valor: String(pix.valor),
            horario: pix?.horario ? new Date(pix.horario) : new Date(),
          };
        }
      } catch {
        // Tentativa ainda não liquidada: a Efí responde que o Pix não existe.
      }
    }

    return null;
  }

  /** Login do cliente a partir do vínculo da recorrência. */
  private async loginDaRecorrencia(idRec: string): Promise<string | null> {
    if (!idRec) return null;
    const cache = this.loginPorRec.get(idRec);
    if (cache) return cache;
    try {
      const rec = await this.efi().pixDetailRecurrenceAutomatic({ idRec });
      const login = rec?.vinculo?.devedor?.nome ?? null;
      if (login) this.loginPorRec.set(idRec, login);
      return login;
    } catch {
      return null;
    }
  }

  /**
   * Marca a mensalidade como paga no MKAuth.
   *
   * A mensalidade certa é a do vencimento da cobrança. A mais antiga em aberto
   * só entra como último recurso, porque um cliente com dois meses em aberto
   * teria o mês errado baixado.
   */
  private async darBaixaNaMensalidade(
    registro: PixAutomaticoCobranca,
    pagamento: { valor: string; horario: Date },
  ): Promise<number | null> {
    if (!registro.login) return null;

    let fatura: Faturas | null = null;

    if (registro.vencimento) {
      const dia = new Date(`${registro.vencimento}T00:00:00`);
      const fim = new Date(`${registro.vencimento}T23:59:59`);
      fatura = await this.faturaRepo.findOne({
        where: {
          login: registro.login,
          status: Not("pago"),
          datadel: IsNull(),
          datavenc: Between(dia, fim),
        },
        order: { id: "ASC" },
      });
    }

    if (!fatura) {
      fatura = await this.faturaRepo.findOne({
        where: {
          login: registro.login,
          status: Not("pago"),
          datadel: IsNull(),
        },
        order: { datavenc: "ASC" },
      });
    }

    if (!fatura) return null;

    await this.faturaRepo.update(String(fatura.id), {
      status: "pago",
      coletor: "api_mk_pedro",
      formapag: "pix_automatico",
      valorpag: pagamento.valor as any,
      datapag: pagamento.horario,
    });

    console.log(
      `✅ Pix Automático: mensalidade ${fatura.id} (${registro.login}) baixada pela cobrança ${registro.txid}.`,
    );

    return fatura.id;
  }

  /**
   * Confere todas as cobranças de um período com a Efí e dá baixa no que
   * estiver pago. É o que segura o sistema quando a notificação não chega.
   */
  async conciliarPeriodo(
    inicio: Date = primeiroDiaDoMes(),
    fim: Date = ultimoDiaDoMes(),
  ): Promise<ResumoConciliacao> {
    const resumo: ResumoConciliacao = {
      periodo: { inicio: formatoEfi(inicio), fim: formatoEfi(fim) },
      cobrancas: 0,
      pagas: 0,
      baixadas: 0,
      jaBaixadas: 0,
      semPagamento: 0,
      erros: [],
    };

    const efipay = this.efi();
    const cobrancas: any[] = [];
    let paginaAtual = 0;
    let quantidadeDePaginas = 1;

    while (paginaAtual < quantidadeDePaginas) {
      const resposta = await efipay.pixListAutomaticCharge({
        inicio: formatoEfi(inicio),
        fim: formatoEfi(fim),
        "paginacao.itensPorPagina": 100,
        "paginacao.paginaAtual": paginaAtual,
      });
      cobrancas.push(...(resposta?.cobsr ?? []));
      quantidadeDePaginas =
        resposta?.parametros?.paginacao?.quantidadeDePaginas ?? 1;
      paginaAtual++;
    }

    resumo.cobrancas = cobrancas.length;

    for (const cobranca of cobrancas) {
      if (!cobranca?.txid) continue;
      const jaBaixada = await this.cobrancaRepo.findOne({
        where: { txid: cobranca.txid },
      });
      if (jaBaixada?.baixadoEm) {
        resumo.jaBaixadas++;
        continue;
      }

      try {
        const registro = await this.sincronizarCobranca(cobranca.txid);
        if (registro.pagoEm) resumo.pagas++;
        else resumo.semPagamento++;
        if (registro.baixadoEm) resumo.baixadas++;
      } catch (erro: any) {
        resumo.erros.push({
          txid: cobranca.txid,
          erro: String(erro?.message || erro).slice(0, 500),
        });
      }
    }

    console.log("📋 Conferência do Pix Automático:", resumo);
    return resumo;
  }

  // -------------------------------------------------------------------------
  // Geração das cobranças do mês
  // -------------------------------------------------------------------------

  /**
   * Garante que toda recorrência aprovada tenha a cobrança do mês.
   *
   * Pode rodar quantas vezes for preciso: antes de criar, verifica na Efí se a
   * cobrança daquele mês já existe. É isso que recupera o mês quando o
   * servidor estava desligado na hora do agendamento.
   */
  async garantirCobrancasDoMes(
    referencia = new Date(),
  ): Promise<ResumoGeracao> {
    const resumo: ResumoGeracao = {
      recorrencias: 0,
      criadas: 0,
      jaExistiam: 0,
      semMensalidade: 0,
      erros: [],
    };

    const inicio = primeiroDiaDoMes(referencia);
    const fim = ultimoDiaDoMes(referencia);
    const efipay = this.efi();

    // Recorrências aprovadas
    const recorrencias: any[] = [];
    let paginaAtual = 0;
    let quantidadeDePaginas = 1;
    while (paginaAtual < quantidadeDePaginas) {
      const resposta = await efipay.pixListRecurrenceAutomatic({
        // Desde quando existem recorrências nesta conta (a consulta exige
        // período). Dá para mudar por variável de ambiente.
        inicio: process.env.PIX_AUTOMATICO_INICIO || "2025-10-18T00:00:00Z",
        fim: formatoEfi(new Date()),
        status: "APROVADA",
        "paginacao.itensPorPagina": 100,
        "paginacao.paginaAtual": paginaAtual,
      });
      recorrencias.push(...(resposta?.recs ?? []));
      quantidadeDePaginas =
        resposta?.parametros?.paginacao?.quantidadeDePaginas ?? 1;
      paginaAtual++;
    }

    resumo.recorrencias = recorrencias.length;

    for (const rec of recorrencias) {
      const login = rec?.vinculo?.devedor?.nome;
      try {
        // Já existe cobrança desta recorrência no mês?
        const existentes = await efipay.pixListAutomaticCharge({
          inicio: formatoEfi(inicio),
          fim: formatoEfi(fim),
          idRec: rec.idRec,
          "paginacao.itensPorPagina": 100,
          "paginacao.paginaAtual": 0,
        });

        const ativas = (existentes?.cobsr ?? []).filter(
          (c: any) => c?.status !== "CANCELADA",
        );
        if (ativas.length > 0) {
          resumo.jaExistiam++;
          continue;
        }

        const fatura = await this.faturaRepo.findOne({
          where: {
            login,
            status: Not("pago"),
            datadel: IsNull(),
            datavenc: Between(inicio, fim),
          },
          order: { datavenc: "ASC" },
        });

        if (!fatura) {
          resumo.semMensalidade++;
          continue;
        }

        const cadastro = await this.clienteRepo.findOne({ where: { login } });
        const valor = Number(fatura.valor) - Number(cadastro?.desconto || 0);

        const criada = await efipay.pixCreateAutomaticCharge("", {
          idRec: rec.idRec,
          ajusteDiaUtil: true,
          calendario: {
            dataDeVencimento: new Date(fatura.datavenc)
              .toISOString()
              .split("T")[0],
          },
          recebedor: {
            agencia: process.env.AGENCIA!,
            conta: process.env.CONTA!,
            tipoConta: "PAGAMENTO",
          },
          valor: { original: valor.toFixed(2) },
          // O número do título deixa a conferência achar a mensalidade certa.
          infoAdicional: `Mensalidade ${fatura.id}`,
        });

        // Espelho local já nasce com o vínculo da mensalidade.
        if (criada?.txid) {
          const registro = this.cobrancaRepo.create({
            txid: criada.txid,
            idRec: rec.idRec,
            login,
            tituloFatura: fatura.id,
            valor: valor.toFixed(2),
            vencimento: new Date(fatura.datavenc).toISOString().split("T")[0],
            status: criada?.status ?? "CRIADA",
          });
          await this.cobrancaRepo.save(registro);
        }

        resumo.criadas++;
        console.log(
          `💳 Pix Automático: cobrança criada para ${login} (mensalidade ${fatura.id}).`,
        );
      } catch (erro: any) {
        resumo.erros.push({
          idRec: rec?.idRec,
          erro: String(erro?.message || erro).slice(0, 500),
        });
      }
    }

    console.log("📋 Geração de cobranças do Pix Automático:", resumo);
    return resumo;
  }
}

export default new PixAutomaticoService();
