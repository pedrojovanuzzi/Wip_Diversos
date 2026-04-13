import { Request, Response } from "express";
import { Between, LessThanOrEqual, Like, MoreThanOrEqual } from "typeorm";
import moment from "moment-timezone";
import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { ChamadoFichaTecnica } from "../entities/ChamadoFichaTecnica";
import { ChamadosEntities } from "../entities/ChamadosEntities";
import { SisMsg } from "../entities/SisMsg";

type Equipamento = {
  tipo: string;
  qtd: number;
  conexao: "CABO" | "WIFI" | null;
  testado: boolean;
};

function montarMensagemFinalizacao(f: ChamadoFichaTecnica): string {
  const partes: string[] = [];
  partes.push(`NUM DO CHAMADO ${f.chamado_number}`);
  partes.push(`RESULTADO FINAL ${f.servico}`);
  partes.push(`NOME DO CLIENTE ${f.cliente}`);
  partes.push(`TECNICO EXTERNO:${f.tec_externo ?? "NENHUM"}`);
  partes.push(`TECNICO INTERNO:${f.tec_interno ?? "NENHUM"}`);
  partes.push(`USUARIO ${f.usuario}`);
  partes.push(`SENHA ${f.senha_wifi ?? ""}`);
  partes.push(`NOTA ${f.nota ?? ""}`);
  partes.push(`QUEM ASSINOU:${f.responsavel_nome ?? ""}`);
  partes.push(`CPF:${f.responsavel_cpf ?? ""}`);
  partes.push(`PORTA OLT ${f.porta_olt ?? ""}`);
  partes.push(`OLT ${f.olt ?? ""}`);
  partes.push(`PLACA DO CARRO ${f.placa_carro ?? ""}`);
  partes.push(`TECNICO DO CARRO ${f.tec_carro ?? "NENHUM"}`);
  partes.push(`CAIXA ${f.caixa ?? ""}`);
  partes.push(`SPLITTER ${f.splitter ?? ""}`);
  partes.push(`SINAL POWER METER ${f.sinal_power_meter ?? ""}`);
  partes.push(`SINAL ONU OU ALTENA ${f.sinal_onu_antena ?? ""}`);
  partes.push(`SINAL CCQ OU CAIXA ${f.sinal_ccq_caixa ?? ""}`);
  partes.push(`SSID:${f.ssid ?? ""}`);
  partes.push(`MAC:${f.mac ?? ""}`);
  partes.push(`SN:${f.sn ?? ""}`);
  partes.push(`HORARIO ${f.horario_registro ?? ""}`);

  const equipamentosAtivos = (f.equipamentos ?? []).filter(
    (e) => e && Number(e.qtd) > 0,
  );
  if (equipamentosAtivos.length > 0) {
    const descricao = equipamentosAtivos
      .map((e) => {
        const qtd = String(e.qtd).padStart(2, "0");
        const conexao = e.conexao ?? "";
        const testado = e.testado ? "Testado" : "Nao Testado";
        return `${qtd} ${e.tipo} ${conexao} ${testado}`.trim();
      })
      .join(" / ");
    partes.push(`CLIENTE TEM: ${descricao}`);
  }

  if (f.motivo) {
    partes.push(`MOTIVO PELO QUAL NAO FOI TESTADO OS EQUIPAMENTOS: ${f.motivo}`);
  }

  if (f.observacao) {
    partes.push(`OBSERVACAO: '${f.observacao}'`);
  }

  return partes.join(" / ");
}

async function sincronizarComMkauth(
  ficha: ChamadoFichaTecnica,
  atendente: string,
): Promise<{ ok: boolean; chamadoId?: string; erro?: string }> {
  const chamadosRepo = MkauthSource.getRepository(ChamadosEntities);
  const sisMsgRepo = MkauthSource.getRepository(SisMsg);

  const ultimoChamado = await chamadosRepo.findOne({
    where: { login: ficha.usuario, status: "aberto" },
    order: { abertura: "DESC" },
  });

  if (!ultimoChamado || !ultimoChamado.chamado) {
    return {
      ok: false,
      erro: `Nenhum chamado ABERTO encontrado no MKAUTH para o login ${ficha.usuario}.`,
    };
  }

  const mensagem = montarMensagemFinalizacao(ficha);

  await sisMsgRepo.save({
    chamado: ultimoChamado.chamado,
    msg: mensagem,
    tipo: "provedor",
    login: ficha.usuario,
    atendente,
    msg_data: new Date(),
  });

  return { ok: true, chamadoId: ultimoChamado.chamado };
}

class ChamadoFichaTecnicaController {
  public create = async (req: Request, res: Response) => {
    try {
      const repo = AppDataSource.getRepository(ChamadoFichaTecnica);
      const body = req.body as Partial<ChamadoFichaTecnica>;

      if (!body.chamado_number || !body.cliente || !body.usuario || !body.servico) {
        res.status(400).json({
          errors: [
            {
              msg: "Campos obrigatórios: chamado_number, cliente, usuario, servico.",
            },
          ],
        });
        return;
      }

      const usuario = String(body.usuario).trim();
      const chamadosRepo = MkauthSource.getRepository(ChamadosEntities);
      const ultimoChamado = await chamadosRepo.findOne({
        where: { login: usuario, status: "aberto" },
        order: { abertura: "DESC" },
      });

      if (!ultimoChamado || !ultimoChamado.chamado) {
        res.status(404).json({
          errors: [
            {
              msg: `Nenhum chamado ABERTO encontrado no MKAUTH para o login ${usuario}. O envio foi bloqueado.`,
            },
          ],
        });
        return;
      }

      const equipamentos: Equipamento[] = Array.isArray(body.equipamentos)
        ? (body.equipamentos as Equipamento[])
        : [];

      const nova = repo.create({
        ...body,
        usuario,
        equipamentos,
        horario_registro:
          body.horario_registro ||
          moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss"),
        criado_por: req.user?.id,
        criado_por_login: req.user?.login,
        mkauth_sincronizado: false,
      });

      const salva = await repo.save(nova);

      const atendente = req.user?.login || "SISTEMA";
      const mensagem = montarMensagemFinalizacao(salva);

      try {
        await MkauthSource.getRepository(SisMsg).save({
          chamado: ultimoChamado.chamado,
          msg: mensagem,
          tipo: "provedor",
          login: usuario,
          atendente,
          msg_data: new Date(),
        });

        salva.mkauth_sincronizado = true;
        salva.mkauth_chamado_id = ultimoChamado.chamado;
        salva.mkauth_erro = undefined as any;
        await repo.save(salva);
      } catch (mkErr: any) {
        salva.mkauth_sincronizado = false;
        salva.mkauth_erro = mkErr?.message || "Falha ao inserir resposta no MKAUTH.";
        await repo.save(salva);

        res.status(502).json({
          errors: [
            {
              msg: "Ficha salva, mas houve falha ao inserir a resposta no MKAUTH. Use o botão de ressincronização.",
            },
          ],
          id: salva.id,
          mkauth_erro: salva.mkauth_erro,
        });
        return;
      }

      res.status(201).json({
        id: salva.id,
        mkauth_sincronizado: salva.mkauth_sincronizado,
        mkauth_chamado_id: salva.mkauth_chamado_id,
      });
    } catch (error: any) {
      console.error("[ChamadoFichaTecnica.create]", error);
      res
        .status(500)
        .json({ errors: [{ msg: "Erro ao salvar ficha técnica." }] });
    }
  };

  public list = async (req: Request, res: Response) => {
    try {
      const {
        startDate,
        endDate,
        page = 1,
        limit = 10,
        cliente,
        usuario,
        servico,
        sincronizado,
      } = req.query;

      const repo = AppDataSource.getRepository(ChamadoFichaTecnica);
      const where: any = {};

      if (startDate && endDate) {
        where.criado_em = Between(
          moment(startDate as string).startOf("day").toDate(),
          moment(endDate as string).endOf("day").toDate(),
        );
      } else if (startDate) {
        where.criado_em = MoreThanOrEqual(
          moment(startDate as string).startOf("day").toDate(),
        );
      } else if (endDate) {
        where.criado_em = LessThanOrEqual(
          moment(endDate as string).endOf("day").toDate(),
        );
      }

      if (cliente) where.cliente = Like(`%${String(cliente).toUpperCase()}%`);
      if (usuario) where.usuario = Like(`%${String(usuario).toUpperCase()}%`);
      if (servico) where.servico = String(servico);
      if (sincronizado === "true") where.mkauth_sincronizado = true;
      if (sincronizado === "false") where.mkauth_sincronizado = false;

      const pageNum = Number(page);
      const limitNum = Number(limit);

      const [data, count] = await repo.findAndCount({
        where,
        order: { criado_em: "DESC" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        select: [
          "id",
          "chamado_number",
          "cliente",
          "usuario",
          "servico",
          "tec_externo",
          "tec_interno",
          "criado_em",
          "criado_por_login",
          "mkauth_sincronizado",
          "mkauth_chamado_id",
          "mkauth_erro",
        ],
      });

      res.status(200).json({
        data,
        total: count,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum),
      });
    } catch (error) {
      console.error("[ChamadoFichaTecnica.list]", error);
      res.status(500).json({ errors: [{ msg: "Erro ao listar fichas." }] });
    }
  };

  public getById = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(ChamadoFichaTecnica);
      const ficha = await repo.findOne({ where: { id } });
      if (!ficha) {
        res.status(404).json({ errors: [{ msg: "Ficha não encontrada." }] });
        return;
      }
      res.status(200).json(ficha);
    } catch (error) {
      console.error("[ChamadoFichaTecnica.getById]", error);
      res.status(500).json({ errors: [{ msg: "Erro ao buscar ficha." }] });
    }
  };

  public buscarChamadoPorLogin = async (req: Request, res: Response) => {
    try {
      const login = String(req.params.login || "").trim();
      if (!login) {
        res.status(400).json({ errors: [{ msg: "Login é obrigatório." }] });
        return;
      }

      const chamadosRepo = MkauthSource.getRepository(ChamadosEntities);
      const ultimoChamado = await chamadosRepo.findOne({
        where: { login, status: "aberto" },
        order: { abertura: "DESC" },
      });

      if (!ultimoChamado || !ultimoChamado.chamado) {
        res.status(404).json({
          errors: [
            {
              msg: `Nenhum chamado ABERTO encontrado no MKAUTH para o login ${login}.`,
            },
          ],
        });
        return;
      }

      res.status(200).json({
        chamado: ultimoChamado.chamado,
        nome: ultimoChamado.nome ?? null,
      });
    } catch (error) {
      console.error("[ChamadoFichaTecnica.buscarChamadoPorLogin]", error);
      res
        .status(500)
        .json({ errors: [{ msg: "Erro ao buscar chamado no MKAUTH." }] });
    }
  };

  public ressincronizar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(ChamadoFichaTecnica);
      const ficha = await repo.findOne({ where: { id } });
      if (!ficha) {
        res.status(404).json({ errors: [{ msg: "Ficha não encontrada." }] });
        return;
      }

      const atendente = req.user?.login || "SISTEMA";
      const resultado = await sincronizarComMkauth(ficha, atendente);

      if (resultado.ok) {
        ficha.mkauth_sincronizado = true;
        ficha.mkauth_chamado_id = resultado.chamadoId;
        ficha.mkauth_erro = undefined as any;
      } else {
        ficha.mkauth_sincronizado = false;
        ficha.mkauth_erro = resultado.erro;
      }
      await repo.save(ficha);

      res.status(200).json({
        mkauth_sincronizado: ficha.mkauth_sincronizado,
        mkauth_chamado_id: ficha.mkauth_chamado_id,
        mkauth_erro: ficha.mkauth_erro,
      });
    } catch (error) {
      console.error("[ChamadoFichaTecnica.ressincronizar]", error);
      res
        .status(500)
        .json({ errors: [{ msg: "Erro ao ressincronizar ficha." }] });
    }
  };
}

export default new ChamadoFichaTecnicaController();
