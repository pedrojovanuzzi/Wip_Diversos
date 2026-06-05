import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";
import { Like } from "typeorm";
import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { CameraCliente } from "../entities/CameraCliente";
import { Camera as CameraEntity } from "../entities/Camera";
import { ClientesEntities } from "../entities/ClientesEntities";
import MediaMtxService from "../services/MediaMtxService";
import { generateStreamToken } from "./CameraAuth";

dotenv.config();

const jwtSecret = String(process.env.JWT_SECRET);
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

      const repo = AppDataSource.getRepository(CameraCliente);
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
      });
      await repo.save(novo);

      res.status(201).json({
        id: novo.id,
        login: novo.login,
        nome: sisCliente.nome,
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
      const repo = AppDataSource.getRepository(CameraCliente);
      let cliente = await repo.findOne({ where: { login } });

      if (!cliente) {
        const mkRepo = MkauthSource.getRepository(ClientesEntities);
        const sisCliente = await mkRepo.findOne({ where: { login } });
        if (!sisCliente) {
          res.status(404).json({ message: "Login não encontrado no sistema." });
          return;
        }
        const setup_uuid = uuidv4();
        cliente = repo.create({ login, setup_uuid, status: "pendente" });
        await repo.save(cliente);
        res.status(201).json({
          login,
          status: "pendente",
          created: true,
          setupLink: `${FRONT_URL}/Cameras/Setup/${setup_uuid}`,
        });
        return;
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
      const repo = AppDataSource.getRepository(CameraCliente);
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

  /** Lista clientes-câmera com a contagem de câmeras. */
  public async listarClientes(_req: Request, res: Response) {
    try {
      const repo = AppDataSource.getRepository(CameraCliente);
      const camRepo = AppDataSource.getRepository(CameraEntity);
      const clientes = await repo.find({ order: { id: "DESC" } });

      const items = await Promise.all(
        clientes.map(async (c) => ({
          id: c.id,
          login: c.login,
          email: c.email,
          status: c.status,
          setupLink: c.setup_uuid
            ? `${FRONT_URL}/Cameras/Setup/${c.setup_uuid}`
            : null,
          totalCameras: await camRepo.count({ where: { cliente_id: c.id } }),
          created_at: c.created_at,
        })),
      );
      res.json({ total: items.length, items });
    } catch (e: any) {
      console.error("listarClientes:", e?.message);
      res.status(500).json({ message: "Erro ao listar clientes." });
    }
  }

  /** Regenera o link de setup (novo UUID) e volta a conta para pendente. */
  public async regenerarLink(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraCliente);
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
      const repo = AppDataSource.getRepository(CameraCliente);
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

  /** Remove um cliente, suas câmeras e os paths no MediaMTX. */
  public async removerCliente(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraCliente);
      const camRepo = AppDataSource.getRepository(CameraEntity);
      const cliente = await repo.findOne({ where: { id } });
      if (!cliente) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }

      const cameras = await camRepo.find({ where: { cliente_id: id } });
      for (const cam of cameras) {
        try {
          await MediaMtxService.removePath(cam.path_name);
        } catch (e: any) {
          console.error("removePath:", e?.message);
        }
      }
      await camRepo.delete({ cliente_id: id });
      await repo.delete(id);
      res.json({ ok: true });
    } catch (e: any) {
      console.error("removerCliente:", e?.message);
      res.status(500).json({ message: "Erro ao remover cliente." });
    }
  }

  // ===================== SETUP (público, via UUID) =====================

  /** Retorna o login (read-only) se o UUID de setup for válido. */
  public async getSetup(req: Request, res: Response) {
    try {
      const uuid = String(req.params.uuid || "");
      const repo = AppDataSource.getRepository(CameraCliente);
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
      const repo = AppDataSource.getRepository(CameraCliente);
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

  // ===================== CLIENTE (portal) =====================

  public async listarCameras(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const repo = AppDataSource.getRepository(CameraEntity);
      const cameras = await repo.find({
        where: { cliente_id: cid },
        order: { id: "DESC" },
      });
      // Não expõe a rtsp_url crua para o navegador.
      res.json({
        items: cameras.map((c) => ({
          id: c.id,
          nome: c.nome,
          ativo: c.ativo,
          created_at: c.created_at,
        })),
      });
    } catch (e: any) {
      console.error("listarCameras:", e?.message);
      res.status(500).json({ message: "Erro ao listar câmeras." });
    }
  }

  public async addCamera(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const nome = String(req.body.nome || "").trim();
      const rtsp_url = String(req.body.rtsp_url || "").trim();

      if (!nome || !rtsp_url) {
        res.status(400).json({ message: "Nome e URL RTSP são obrigatórios." });
        return;
      }
      if (!/^rtsps?:\/\//i.test(rtsp_url)) {
        res.status(400).json({ message: "A URL deve começar com rtsp:// ou rtsps://" });
        return;
      }

      const path_name = `cli${cid}_cam_${uuidv4().slice(0, 8)}`;
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = repo.create({
        cliente_id: cid,
        nome,
        rtsp_url,
        path_name,
        ativo: true,
      });
      await repo.save(cam);

      try {
        await MediaMtxService.addPath(path_name, rtsp_url);
      } catch (e: any) {
        console.error("addPath:", e?.message);
        // Mantém no DB; o syncAllActive tentará novamente. Avisa o cliente.
        res.status(201).json({
          id: cam.id,
          nome: cam.nome,
          ativo: cam.ativo,
          warning: "Câmera salva, mas o servidor de mídia não respondeu agora.",
        });
        return;
      }

      res.status(201).json({ id: cam.id, nome: cam.nome, ativo: cam.ativo });
    } catch (e: any) {
      console.error("addCamera:", e?.message);
      res.status(500).json({ message: "Erro ao adicionar câmera." });
    }
  }

  public async editCamera(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }

      const nome = req.body.nome !== undefined ? String(req.body.nome).trim() : cam.nome;
      const rtsp_url =
        req.body.rtsp_url !== undefined
          ? String(req.body.rtsp_url).trim()
          : cam.rtsp_url;

      if (rtsp_url && !/^rtsps?:\/\//i.test(rtsp_url)) {
        res.status(400).json({ message: "A URL deve começar com rtsp:// ou rtsps://" });
        return;
      }

      const sourceChanged = rtsp_url !== cam.rtsp_url;
      cam.nome = nome;
      cam.rtsp_url = rtsp_url;
      await repo.save(cam);

      if (sourceChanged && cam.ativo) {
        try {
          await MediaMtxService.addPath(cam.path_name, cam.rtsp_url);
        } catch (e: any) {
          console.error("addPath(edit):", e?.message);
        }
      }
      res.json({ id: cam.id, nome: cam.nome, ativo: cam.ativo });
    } catch (e: any) {
      console.error("editCamera:", e?.message);
      res.status(500).json({ message: "Erro ao editar câmera." });
    }
  }

  public async removeCamera(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      try {
        await MediaMtxService.removePath(cam.path_name);
      } catch (e: any) {
        console.error("removePath:", e?.message);
      }
      await repo.delete(id);
      res.json({ ok: true });
    } catch (e: any) {
      console.error("removeCamera:", e?.message);
      res.status(500).json({ message: "Erro ao remover câmera." });
    }
  }

  /** URL WebRTC (WHEP) ao vivo + token curto para o MediaMTX autorizar. */
  public async getStream(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const token = generateStreamToken(cid, cam.path_name);
      res.json({
        whepUrl: MediaMtxService.buildWhepUrl(cam.path_name, token),
        token,
      });
    } catch (e: any) {
      console.error("getStream:", e?.message);
      res.status(500).json({ message: "Erro ao obter stream." });
    }
  }

  /** Lista os segmentos gravados da câmera. */
  public async listRecordings(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const segments = await MediaMtxService.listRecordings(cam.path_name);
      res.json({ items: segments });
    } catch (e: any) {
      console.error("listRecordings:", e?.message);
      res.status(500).json({ message: "Erro ao listar gravações." });
    }
  }

  /** URL de playback de um trecho gravado. */
  public async getRecordingPlayback(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const start = String(req.query.start || "");
      const duration = Number(req.query.duration || 60);
      if (!start) {
        res.status(400).json({ message: "Parâmetro start é obrigatório." });
        return;
      }
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const token = generateStreamToken(cid, cam.path_name);
      res.json({
        url: MediaMtxService.buildPlaybackUrl(cam.path_name, start, duration, token),
        token,
      });
    } catch (e: any) {
      console.error("getRecordingPlayback:", e?.message);
      res.status(500).json({ message: "Erro ao obter playback." });
    }
  }

  // ===================== AUTH EXTERNA DO MEDIAMTX =====================

  /**
   * Endpoint chamado pelo MediaMTX (authMethod: http) para autorizar leitura.
   * Libera apenas se o token curto for válido E o path solicitado pertencer ao cliente.
   * Responde 200 (libera) ou 401 (nega).
   */
  public async mediamtxAuth(req: Request, res: Response) {
    try {
      const { path, action, query } = req.body as {
        path?: string;
        action?: string;
        query?: string;
      };

      // Publicação/leitura interna pelo próprio servidor: libera ações não-read sem token
      // apenas para o pull RTSP iniciado pelo MediaMTX (action "read" do navegador exige token).
      if (action && action !== "read" && action !== "playback") {
        res.status(200).end();
        return;
      }

      // Extrai token tanto do body.query ("token=...") quanto de req.query.
      let token = (req.query.token as string) || "";
      if (!token && query) {
        token = new URLSearchParams(query).get("token") || "";
      }
      if (!token) {
        res.status(401).end();
        return;
      }

      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      if (decoded.tipo !== "camera_stream" || !decoded.path) {
        res.status(401).end();
        return;
      }
      if (path && decoded.path !== path) {
        res.status(401).end();
        return;
      }
      res.status(200).end();
    } catch (e) {
      res.status(401).end();
    }
  }
}

export default new Camera();
