import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import { LicencaEntity } from "../entities/LicencaEntities";

/**
 * Campos fiscais do tomador, usados na NFS-e da licença. Ficam separados do
 * resto porque só entram quando informados: salvar a licença sem eles não
 * pode apagar o que já estava preenchido.
 */
function dadosFiscaisDoCorpo(corpo: any) {
  const campos = [
    "razao_social",
    "email",
    "telefone",
    "endereco",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "codigo_municipio",
    "uf",
    "cep",
  ] as const;

  const dados: Record<string, string | null> = {};

  if (corpo?.documento !== undefined) {
    dados.documento = String(corpo.documento).replace(/\D/g, "") || null;
  }
  if (corpo?.cep !== undefined) {
    dados.cep = String(corpo.cep).replace(/\D/g, "") || null;
  }

  for (const campo of campos) {
    if (campo === "cep") continue;
    if (corpo?.[campo] === undefined) continue;
    const valor = String(corpo[campo] ?? "").trim();
    dados[campo] = valor || null;
  }

  return dados;
}

class LicencaController {
  constructor() {
    this.criarLicenca = this.criarLicenca.bind(this);
    this.listarLicencas = this.listarLicencas.bind(this);
    this.atualizarStatus = this.atualizarStatus.bind(this);
    this.atualizarLicenca = this.atualizarLicenca.bind(this);
    this.verificarLicenca = this.verificarLicenca.bind(this);
    this.removerLicenca = this.removerLicenca.bind(this);
    this.recuperarChaveLicenca = this.recuperarChaveLicenca.bind(this);
  }

  public async criarLicenca(req: Request, res: Response): Promise<void> {
    try {
      const { cliente_nome, software, chave, observacao } = req.body;

      if (!cliente_nome || !chave) {
        res.status(400).json({ message: "Cliente e Chave são obrigatórios." });
        return;
      }

      const licencaRepo = AppDataSource.getRepository(LicencaEntity);

      const existe = await licencaRepo.findOne({ where: { chave } });
      if (existe) {
        res
          .status(409)
          .json({ message: "Já existe uma licença com esta chave." });
        return;
      }

      const novaLicenca = licencaRepo.create({
        cliente_nome,
        software,
        chave,
        observacao,
        ...dadosFiscaisDoCorpo(req.body),
        status: "ativo",
      });

      await licencaRepo.save(novaLicenca);

      res.status(201).json(novaLicenca);
    } catch (error) {
      console.error("Erro ao criar licença:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  }

  public async listarLicencas(req: Request, res: Response): Promise<void> {
    try {
      const licencaRepo = AppDataSource.getRepository(LicencaEntity);
      const licencas = await licencaRepo.find({
        order: { created_at: "DESC" },
      });
      res.status(200).json(licencas);
    } catch (error) {
      console.error("Erro ao listar licenças:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  }

  /** Edita a licença, inclusive os dados fiscais usados na NFS-e. */
  public async atualizarLicenca(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const licencaRepo = AppDataSource.getRepository(LicencaEntity);
      const licenca = await licencaRepo.findOne({ where: { id: Number(id) } });

      if (!licenca) {
        res.status(404).json({ message: "Licença não encontrada." });
        return;
      }

      const { cliente_nome, software, observacao } = req.body ?? {};
      if (cliente_nome !== undefined)
        licenca.cliente_nome = String(cliente_nome).trim();
      if (software !== undefined) licenca.software = String(software).trim();
      if (observacao !== undefined) licenca.observacao = observacao;

      Object.assign(licenca, dadosFiscaisDoCorpo(req.body));

      await licencaRepo.save(licenca);
      res.status(200).json(licenca);
    } catch (error) {
      console.error("Erro ao atualizar licença:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  }

  public async atualizarStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["ativo", "bloqueado", "cancelado"].includes(status)) {
        res.status(400).json({ message: "Status inválido." });
        return;
      }

      const licencaRepo = AppDataSource.getRepository(LicencaEntity);
      const licenca = await licencaRepo.findOne({ where: { id: Number(id) } });

      if (!licenca) {
        res.status(404).json({ message: "Licença não encontrada." });
        return;
      }

      licenca.status = status;
      await licencaRepo.save(licenca);

      res.status(200).json(licenca);
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  }

  public async verificarLicenca(req: Request, res: Response): Promise<void> {
    try {
      const { chave, software } = req.body;
      // Também aceita via query params para GET simples
      const queryChave = chave || req.query.chave;

      if (!queryChave) {
        res
          .status(400)
          .json({ authorized: false, message: "Chave não informada." });
        return;
      }

      const licencaRepo = AppDataSource.getRepository(LicencaEntity);
      const licenca = await licencaRepo.findOne({
        where: { chave: queryChave as string },
      });

      if (!licenca) {
        // Opcional: Criar licença pendente/desconhecida automaticamente? Por enquanto não.
        res
          .status(403)
          .json({ authorized: false, message: "Licença não encontrada." });
        return;
      }

      if (licenca.status !== "ativo") {
        res.status(403).json({
          authorized: false,
          status: licenca.status,
          message: "Licença bloqueada ou cancelada.",
        });
        return;
      }

      // Se passou por tudo, está aprovado
      res.status(200).json({
        authorized: true,
        message: "Licença ativa.",
        cliente: licenca.cliente_nome,
      });
    } catch (error) {
      console.error("Erro ao verificar licença:", error);
      res.status(500).json({ authorized: false, message: "Erro interno." });
    }
  }

  public async recuperarChaveLicenca(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { software } = req.body;

      if (!software) {
        res.status(400).json({
          message: "Software é obrigatório para recuperar a chave.",
        });
        return;
      }

      const licencaRepo = AppDataSource.getRepository(LicencaEntity);
      const licenca = await licencaRepo.findOne({
        where: {
          software: software as string,
        },
      });

      if (!licenca) {
        res.status(404).json({ message: "Licença não encontrada." });
        return;
      }

      res.status(200).json({
        chave: licenca.chave,
        status: licenca.status,
        cliente: licenca.cliente_nome,
        software: licenca.software,
      });
    } catch (error) {
      console.error("Erro ao recuperar chave da licença:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  }

  public async removerLicenca(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const licencaRepo = AppDataSource.getRepository(LicencaEntity);

      const result = await licencaRepo.delete(id);

      if (result.affected === 0) {
        res.status(404).json({ message: "Licença não encontrada." });
        return;
      }

      res.status(200).json({ message: "Licença removida com sucesso." });
    } catch (error) {
      console.error("Erro ao remover licença:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  }
}

export default new LicencaController();
