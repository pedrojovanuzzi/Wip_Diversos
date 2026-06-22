import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { Like } from "typeorm";
import CamsSource from "../database/CamsSource";
import MkauthSource from "../database/MkauthSource";
import { CameraCliente } from "../entities/CameraCliente";
import { Camera as CameraEntity } from "../entities/Camera";
import { ClientesEntities } from "../entities/ClientesEntities";
import { SisSerContratos } from "../entities/SisSerContratos";
import {
  STORAGE_PLANS,
  normalizeStorageGb,
  isValidStorageGb,
  planFor,
} from "../config/cameraStoragePlans";
import NginxService from "../services/NginxService";

dotenv.config();

const FRONT_URL = (process.env.URL || "http://localhost:3001").replace(/\/$/, "");

class Camera {
  // ===================== ADMIN (operador interno) =====================

  /** Autocomplete de clientes do mkauth (sis_cliente) por login ou nome. */
  public async buscarSisClientes(req: Request, res: Response) {
    try {
      const search = String(req.query.search || "").trim();
      if (search.length < 2) {
        res.json({ items: [] });
        return;
      }
      const repo = MkauthSource.getRepository(ClientesEntities);
      const items = await repo.find({
        where: [{ login: Like(`%${search}%`) }, { nome: Like(`%${search}%`) }],
        select: ["login", "nome"],
        take: 20,
      });
      res.json({
        items: items
          .filter((c) => c.login)
          .map((c) => ({ login: c.login, nome: c.nome })),
      });
    } catch (e: any) {
      console.error("buscarSisClientes:", e?.message);
      res.status(500).json({ message: "Erro ao buscar clientes." });
    }
  }

  /** Cria um cliente-câmera a partir de um login PPPOE (selecionado no autocomplete). */
  public async criarCliente(req: Request, res: Response) {
    try {
      const login = String(req.body.login || "").trim();
      if (!login) {
        res.status(400).json({ message: "Login é obrigatório." });
        return;
      }

      // Revalida que o login existe no mkauth.
      const mkRepo = MkauthSource.getRepository(ClientesEntities);
      const sisCliente = await mkRepo.findOne({ where: { login } });
      if (!sisCliente) {
        res.status(404).json({ message: "Login não encontrado no sistema." });
        return;
      }

      const repo = CamsSource.getRepository(CameraCliente);
      const existente = await repo.findOne({ where: { login } });
      if (existente) {
        res
          .status(409)
          .json({ message: "Este login já possui uma conta de câmeras." });
        return;
      }

      const setup_uuid = uuidv4();
      const novo = repo.create({
        login,
        setup_uuid,
        status: "pendente",
        storage_gb: normalizeStorageGb(req.body.storageGb),
      });
      await repo.save(novo);

      res.status(201).json({
        id: novo.id,
        login: novo.login,
        nome: sisCliente.nome,
        storageGb: novo.storage_gb,
        setupLink: `${FRONT_URL}/Cameras/Setup/${setup_uuid}`,
      });
    } catch (e: any) {
      console.error("criarCliente:", e?.message);
      res.status(500).json({ message: "Erro ao criar cliente." });
    }
  }

  /**
   * Garante uma conta de câmeras para o login (idempotente) e devolve o link de setup.
   * Usado ao adicionar câmera na tela de Serviços (SerContratos).
   * - Não existe -> cria pendente e retorna o link.
   * - Existe pendente -> retorna o link existente.
   * - Existe configurada (ativa/bloqueada) -> não retorna link (alreadyConfigured).
   */
  public async ensureCliente(req: Request, res: Response) {
    try {
      const login = String(req.body.login || "").trim();
      if (!login) {
        res.status(400).json({ message: "Login é obrigatório." });
        return;
      }
      const repo = CamsSource.getRepository(CameraCliente);
      let cliente = await repo.findOne({ where: { login } });
      // Plano de armazenamento escolhido ao adicionar o serviço (opcional).
      const storageGb =
        req.body.storageGb !== undefined ? normalizeStorageGb(req.body.storageGb) : null;

      if (!cliente) {
        const mkRepo = MkauthSource.getRepository(ClientesEntities);
        const sisCliente = await mkRepo.findOne({ where: { login } });
        if (!sisCliente) {
          res.status(404).json({ message: "Login não encontrado no sistema." });
          return;
        }
        const setup_uuid = uuidv4();
        cliente = repo.create({
          login,
          setup_uuid,
          status: "pendente",
          storage_gb: storageGb ?? undefined,
        });
        await repo.save(cliente);
        res.status(201).json({
          login,
          status: "pendente",
          created: true,
          storageGb: cliente.storage_gb,
          setupLink: `${FRONT_URL}/Cameras/Setup/${setup_uuid}`,
        });
        return;
      }

      // Conta já existe: se veio um plano, atualiza a cota.
      if (storageGb !== null && cliente.storage_gb !== storageGb) {
        cliente.storage_gb = storageGb;
        await repo.save(cliente);
      }

      if (cliente.status === "pendente" && cliente.setup_uuid) {
        res.json({
          login,
          status: "pendente",
          created: false,
          setupLink: `${FRONT_URL}/Cameras/Setup/${cliente.setup_uuid}`,
        });
        return;
      }

      res.json({
        login,
        status: cliente.status,
        alreadyConfigured: true,
        setupLink: null,
      });
    } catch (e: any) {
      console.error("ensureCliente:", e?.message);
      res.status(500).json({ message: "Erro ao gerar acesso do cliente." });
    }
  }

  /** Edita informações do cliente (e-mail). */
  public async updateCliente(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const repo = CamsSource.getRepository(CameraCliente);
      const cliente = await repo.findOne({ where: { id } });
      if (!cliente) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }
      if (req.body.email !== undefined) {
        cliente.email = String(req.body.email).trim() || null;
      }
      await repo.save(cliente);
      res.json({ ok: true, email: cliente.email });
    } catch (e: any) {
      console.error("updateCliente:", e?.message);
      res.status(500).json({ message: "Erro ao atualizar cliente." });
    }
  }

  /**
   * Troca o plano de armazenamento de um cliente (upgrade/downgrade).
   * Atualiza a cota (camera_clientes.storage_gb) E o valor cobrado no contrato
   * CAMERA (sis_sercontratos). Se ainda não houver contrato CAMERA, só a cota muda.
   */
  public async updatePlano(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const storageGb = Number(req.body.storageGb);
      if (!isValidStorageGb(storageGb)) {
        res.status(400).json({
          message: "Plano inválido. Use 5, 10, 15 ou 20 GB.",
        });
        return;
      }
      const repo = CamsSource.getRepository(CameraCliente);
      const cliente = await repo.findOne({ where: { id } });
      if (!cliente) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }

      cliente.storage_gb = storageGb;
      await repo.save(cliente);

      // Ajusta o valor do contrato CAMERA do cliente (se existir) para o preço do plano.
      const plano = planFor(storageGb)!;
      const serRepo = MkauthSource.getRepository(SisSerContratos);
      const updated = await serRepo
        .createQueryBuilder()
        .update(SisSerContratos)
        .set({ valor: plano.priceBRL })
        .where("UPPER(TRIM(login)) = UPPER(TRIM(:l))", { l: cliente.login })
        .andWhere("UPPER(TRIM(nome)) = :nome", { nome: "CAMERA" })
        .execute();

      res.json({
        ok: true,
        storageGb: cliente.storage_gb,
        priceBRL: plano.priceBRL,
        contratoAtualizado: (updated.affected ?? 0) > 0,
      });
    } catch (e: any) {
      console.error("updatePlano:", e?.message);
      res.status(500).json({ message: "Erro ao atualizar plano." });
    }
  }

  /** Lista clientes-câmera com a contagem de câmeras. */
  public async listarClientes(_req: Request, res: Response) {
    try {
      const repo = CamsSource.getRepository(CameraCliente);
      const camRepo = CamsSource.getRepository(CameraEntity);
      const clientes = await repo.find({ order: { id: "DESC" } });

      const items = await Promise.all(
        clientes.map(async (c) => ({
          id: c.id,
          login: c.login,
          email: c.email,
          status: c.status,
          storageGb: c.storage_gb,
          storagePriceBRL: planFor(c.storage_gb)?.priceBRL ?? null,
          setupLink: c.setup_uuid
            ? `${FRONT_URL}/Cameras/Setup/${c.setup_uuid}`
            : null,
          totalCameras: await camRepo.count({ where: { cliente_id: c.id } }),
          created_at: c.created_at,
        })),
      );
      res.json({ total: items.length, items, plans: STORAGE_PLANS });
    } catch (e: any) {
      console.error("listarClientes:", e?.message);
      res.status(500).json({ message: "Erro ao listar clientes." });
    }
  }

  /** Regenera o link de setup (novo UUID) e volta a conta para pendente. */
  public async regenerarLink(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const repo = CamsSource.getRepository(CameraCliente);
      const cliente = await repo.findOne({ where: { id } });
      if (!cliente) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }
      cliente.setup_uuid = uuidv4();
      cliente.status = "pendente";
      await repo.save(cliente);
      res.json({
        setupLink: `${FRONT_URL}/Cameras/Setup/${cliente.setup_uuid}`,
      });
    } catch (e: any) {
      console.error("regenerarLink:", e?.message);
      res.status(500).json({ message: "Erro ao regenerar link." });
    }
  }

  /** Bloqueia/desbloqueia um cliente. */
  public async toggleStatusCliente(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { status } = req.body as { status?: string };
      if (!["ativo", "bloqueado"].includes(String(status))) {
        res.status(400).json({ message: "status inválido." });
        return;
      }
      const repo = CamsSource.getRepository(CameraCliente);
      const cliente = await repo.findOne({ where: { id } });
      if (!cliente) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }
      cliente.status = status as "ativo" | "bloqueado";
      await repo.save(cliente);
      res.json({ ok: true, status: cliente.status });
    } catch (e: any) {
      console.error("toggleStatusCliente:", e?.message);
      res.status(500).json({ message: "Erro ao alterar status." });
    }
  }

  /** Remove um cliente e suas câmeras. */
  public async removerCliente(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const repo = CamsSource.getRepository(CameraCliente);
      const camRepo = CamsSource.getRepository(CameraEntity);
      const cliente = await repo.findOne({ where: { id } });
      if (!cliente) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }

      await camRepo.delete({ cliente_id: id });
      await repo.delete(id);
      res.json({ ok: true });
    } catch (e: any) {
      console.error("removerCliente:", e?.message);
      res.status(500).json({ message: "Erro ao remover cliente." });
    }
  }

  // ===================== NGINX (admin) =====================

  public async nginxStatus(_req: Request, res: Response) {
    const result = await NginxService.checkStatus();
    res.json(result);
  }

  public async nginxApply(_req: Request, res: Response) {
    const result = await NginxService.applyMediaMtxBlock();
    res.status(result.ok ? 200 : 500).json(result);
  }

  // ===================== SETUP (público, via UUID) =====================

  /** Retorna o login (read-only) se o UUID de setup for válido. */
  public async getSetup(req: Request, res: Response) {
    try {
      const uuid = String(req.params.uuid || "");
      const repo = CamsSource.getRepository(CameraCliente);
      const cliente = await repo.findOne({ where: { setup_uuid: uuid } });
      if (!cliente) {
        res.status(404).json({ message: "Link inválido ou já utilizado." });
        return;
      }
      res.json({ login: cliente.login });
    } catch (e: any) {
      console.error("getSetup:", e?.message);
      res.status(500).json({ message: "Erro ao validar link." });
    }
  }

  /** Cliente define email + senha. Login permanece travado; UUID é invalidado. */
  public async definirSenha(req: Request, res: Response) {
    try {
      await body("email").isEmail().withMessage("E-mail inválido").run(req);
      await body("password")
        .isLength({ min: 6 })
        .withMessage("Senha tem que ter no mínimo 6 caracteres")
        .run(req);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const uuid = String(req.params.uuid || "");
      const { email, password } = req.body;
      const repo = CamsSource.getRepository(CameraCliente);
      const cliente = await repo.findOne({ where: { setup_uuid: uuid } });
      if (!cliente) {
        res.status(404).json({ message: "Link inválido ou já utilizado." });
        return;
      }

      const salt = await bcrypt.genSalt();
      cliente.email = email;
      cliente.password = await bcrypt.hash(password, salt);
      cliente.status = "ativo";
      cliente.setup_uuid = null;
      await repo.save(cliente);

      res.json({ ok: true, login: cliente.login });
    } catch (e: any) {
      console.error("definirSenha:", e?.message);
      res.status(500).json({ message: "Erro ao definir senha." });
    }
  }
}

export default new Camera();
