import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Like } from "typeorm";
import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { CameraCliente } from "../entities/CameraCliente";
import { Camera as CameraEntity } from "../entities/Camera";
import { ClientesEntities } from "../entities/ClientesEntities";
import MediaMtxService from "../services/MediaMtxService";
import CameraStorageService from "../services/CameraStorageService";
import {
  digestGet,
  digestGetRaw,
  parseRtspCreds,
  CAMERA_HTTP_PORT,
} from "../services/CameraHttp";
import CameraIvsService from "../services/CameraIvsService";
import NginxService from "../services/NginxService";
import { generateStreamToken } from "./CameraAuth";

dotenv.config();

const jwtSecret = String(process.env.JWT_SECRET);
const FRONT_URL = (process.env.URL || "http://localhost:3001").replace(/\/$/, "");
// Pasta no host onde o MediaMTX grava (volume Docker). Configurável por .env.
const RECORDINGS_PATH =
  process.env.MEDIAMTX_RECORDINGS_PATH ||
  "/var/lib/docker/volumes/backend_mediamtx_recordings/_data";

/** Resolve o diretório de gravações de uma câmera, validando a posse pelo cliente. */
async function getCameraDir(
  cid: number,
  id: number,
): Promise<{ cam: CameraEntity; dir: string } | null> {
  const repo = AppDataSource.getRepository(CameraEntity);
  const cam = await repo.findOne({ where: { id, cliente_id: cid } });
  if (!cam) return null;
  return { cam, dir: path.join(RECORDINGS_PATH, cam.path_name) };
}

/** Apaga a pasta de gravações de uma câmera no disco (ao remover a câmera). */
function deleteCameraRecordings(pathName: string): void {
  try {
    if (!pathName) return;
    const dir = path.join(RECORDINGS_PATH, pathName);
    // Garante que estamos dentro do RECORDINGS_PATH (evita remoção indevida).
    if (!dir.startsWith(RECORDINGS_PATH)) return;
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`🗑️  Gravações removidas: ${dir}`);
    }
  } catch (e: any) {
    console.error("deleteCameraRecordings:", e?.message);
  }
}

/**
 * Quebra uma URL RTSP em partes para editar só host/porta sem mexer nas
 * credenciais nem no caminho. Ex.: rtsp://user:pass@1.2.3.4:554/stream
 *   -> { prefix: "rtsp://user:pass@", host: "1.2.3.4", port: "554", rest: "/stream" }
 */
function parseRtsp(
  url: string,
): { prefix: string; host: string; port: string; rest: string } | null {
  const m = url.match(/^(rtsps?:\/\/(?:[^@/]+@)?)([^:/?#]+)(?::(\d+))?(.*)$/i);
  if (!m) return null;
  return { prefix: m[1], host: m[2], port: m[3] || "", rest: m[4] || "" };
}

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
        CameraIvsService.stopCamera(cam.path_name);
        try {
          await MediaMtxService.removePath(cam.path_name);
        } catch (e: any) {
          console.error("removePath:", e?.message);
        }
        // Apaga as gravações do disco de cada câmera.
        deleteCameraRecordings(cam.path_name);
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
          gravando: c.gravando,
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
      // Tipo: só Intelbras/Dahua têm suporte à detecção (CGI Dahua).
      const tipoRaw = String(req.body.tipo || "intelbras").toLowerCase();
      const tipo = ["intelbras", "dahua"].includes(tipoRaw) ? tipoRaw : "intelbras";

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
        tipo,
        rtsp_url,
        path_name,
        ativo: true,
      });
      await repo.save(cam);

      // Inicia o listener de movimento (vai ligar a gravação quando detectar).
      CameraIvsService.startCamera(cam);

      try {
        // Base sem gravação contínua — a gravação é disparada por movimento.
        await MediaMtxService.addPath(path_name, rtsp_url, false);
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

  /** Dados para a tela de edição (nome + host/porta; a senha NÃO é exposta). */
  public async getCameraDetail(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const parts = parseRtsp(cam.rtsp_url);
      res.json({
        id: cam.id,
        nome: cam.nome,
        ativo: cam.ativo,
        rtsp_url: cam.rtsp_url, // URL completa (dono da câmera pode editar)
        host: parts?.host || "",
        port: parts?.port || "",
        http_port: cam.http_port || 80,
      });
    } catch (e: any) {
      console.error("getCameraDetail:", e?.message);
      res.status(500).json({ message: "Erro ao obter câmera." });
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

      // Monta a nova URL. Aceita rtsp_url completo OU só ip/porta (rebuild,
      // preservando credenciais e caminho). O navegador usa ip/porta.
      let rtsp_url = cam.rtsp_url;
      if (req.body.rtsp_url !== undefined && String(req.body.rtsp_url).trim()) {
        rtsp_url = String(req.body.rtsp_url).trim();
        if (!/^rtsps?:\/\//i.test(rtsp_url)) {
          res.status(400).json({ message: "A URL deve começar com rtsp:// ou rtsps://" });
          return;
        }
      } else if (req.body.ip !== undefined || req.body.porta !== undefined) {
        const parts = parseRtsp(cam.rtsp_url);
        if (!parts) {
          res.status(400).json({
            message: "Não foi possível interpretar a URL atual; edite a URL completa.",
          });
          return;
        }
        const ip =
          req.body.ip !== undefined ? String(req.body.ip).trim() : parts.host;
        const porta =
          req.body.porta !== undefined
            ? String(req.body.porta).trim()
            : parts.port;
        if (!ip) {
          res.status(400).json({ message: "O IP é obrigatório." });
          return;
        }
        if (porta && !/^\d+$/.test(porta)) {
          res.status(400).json({ message: "Porta inválida." });
          return;
        }
        rtsp_url = `${parts.prefix}${ip}${porta ? `:${porta}` : ""}${parts.rest}`;
      }

      const sourceChanged = rtsp_url !== cam.rtsp_url;

      // Porta HTTP da câmera (eventos/CGI).
      let httpChanged = false;
      if (req.body.http_port !== undefined) {
        const hp = Number(req.body.http_port);
        if (!Number.isInteger(hp) || hp < 1 || hp > 65535) {
          res.status(400).json({ message: "Porta HTTP inválida." });
          return;
        }
        httpChanged = hp !== cam.http_port;
        cam.http_port = hp;
      }

      cam.nome = nome;
      cam.rtsp_url = rtsp_url;
      await repo.save(cam);

      if (sourceChanged && cam.ativo) {
        try {
          await MediaMtxService.addPath(cam.path_name, cam.rtsp_url, false);
        } catch (e: any) {
          console.error("addPath(edit):", e?.message);
        }
      }
      // Host, credenciais ou porta HTTP mudaram: reconecta o listener de movimento.
      if ((sourceChanged || httpChanged) && cam.ativo) {
        CameraIvsService.startCamera(cam);
      }
      res.json({ id: cam.id, nome: cam.nome, ativo: cam.ativo });
    } catch (e: any) {
      console.error("editCamera:", e?.message);
      res.status(500).json({ message: "Erro ao editar câmera." });
    }
  }

  /**
   * Pausa/retoma a gravação por movimento (interruptor mestre). O ao vivo
   * continua. Pausado: não grava nem com movimento; retomado: grava quando a
   * câmera detectar movimento. Persiste o estado em `gravando`.
   */
  public async setRecording(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const gravando = req.body.gravando === true || req.body.gravando === "true";
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }

      cam.gravando = gravando;
      await repo.save(cam);

      // Interruptor mestre da gravação por movimento. Pausar desliga já; retomar
      // não liga agora — a gravação volta no próximo movimento detectado.
      CameraIvsService.setEnabled(cam.path_name, gravando);

      res.json({ id: cam.id, gravando: cam.gravando });
    } catch (e: any) {
      console.error("setRecording:", e?.message);
      res.status(500).json({ message: "Erro ao alterar a gravação." });
    }
  }

  /** Lê a configuração de detecção de movimento NA PRÓPRIA CÂMERA. */
  public async getMotionDetect(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const creds = parseRtspCreds(cam.rtsp_url);
      if (!creds) {
        res.status(400).json({ message: "URL da câmera inválida." });
        return;
      }
      const { status, body } = await digestGet(
        creds.host,
        cam.http_port || CAMERA_HTTP_PORT,
        creds.user,
        creds.pass,
        "/cgi-bin/configManager.cgi?action=getConfig&name=MotionDetect",
      );
      if (status !== 200) {
        res.status(502).json({
          message:
            "Não foi possível conectar à câmera. Verifique o IP e a Porta HTTP em ✏️ Editar câmera.",
        });
        return;
      }
      const val = (k: string) => {
        const m = body.match(
          new RegExp(`MotionDetect\\[0\\]\\.${k}=([^\\r\\n]+)`),
        );
        return m ? m[1].trim() : "";
      };
      // Região da Window[0]: 18 linhas, cada uma um bitmask de 14 colunas.
      const region: number[] = [];
      for (let i = 0; i < 18; i++) {
        const m = body.match(
          new RegExp(`MotionDetectWindow\\[0\\]\\.Region\\[${i}\\]=(\\d+)`),
        );
        region.push(m ? Number(m[1]) : 0);
      }
      res.json({
        enable: val("Enable") === "true",
        recordEnable: val("EventHandler\\.RecordEnable") === "true",
        // Latch do BACKEND (segundos após o movimento). Fonte: entidade.
        recordLatch: cam.record_latch ?? 8,
        // Anti-tremor da câmera: segura o evento ativo após o movimento parar.
        dejitter: Number(val("EventHandler\\.Dejitter")) || 0,
        sensitive: Number(val("MotionDetectWindow\\[0\\]\\.Sensitive")) || 40,
        threshold: Number(val("MotionDetectWindow\\[0\\]\\.Threshold")) || 8,
        region, // máscara atual (para o editor de região no app)
        gridRows: 18,
        gridCols: 14,
      });
    } catch (e: any) {
      console.error("getMotionDetect:", e?.message);
      res.status(502).json({
        message:
          "Não foi possível conectar à câmera. Verifique o IP e a Porta HTTP em ✏️ Editar câmera.",
      });
    }
  }

  /** Ativa/ajusta a detecção de movimento NA PRÓPRIA CÂMERA. */
  public async setMotionDetect(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const creds = parseRtspCreds(cam.rtsp_url);
      if (!creds) {
        res.status(400).json({ message: "URL da câmera inválida." });
        return;
      }

      const b = req.body || {};
      const clamp = (v: any, min: number, max: number, def: number) => {
        const n = Number(v);
        return isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
      };
      const enable = b.enable === true || b.enable === "true";
      const recordEnable = b.recordEnable === true || b.recordEnable === "true";
      const sensitive = clamp(b.sensitive, 0, 100, 40);
      const threshold = clamp(b.threshold, 0, 100, 8);
      // Latch do backend (segundos que o MediaMTX segue gravando após o
      // movimento parar). 0 = para na hora. É o que vale de verdade.
      const recordLatch = clamp(b.recordLatch, 0, 600, 8);
      // Anti-tremor da câmera (segura o evento ativo após o movimento parar).
      // Valor alto estica o clipe; baixo encurta. 0..100s.
      const dejitter = clamp(b.dejitter, 0, 100, 1);

      // Persiste o latch na câmera e aplica ao listener em execução.
      cam.record_latch = recordLatch;
      await AppDataSource.getRepository(CameraEntity).save(cam);
      CameraIvsService.setLatch(cam.path_name, recordLatch);

      const ROWS = 18;
      // Região desenhada no app (18 linhas; cada uma um bitmask de 14 colunas,
      // 0..16383). Se vier válida, usamos ela; senão, espelhamos a que já está
      // na câmera (Window[0]).
      let region: string[] | null = null;
      if (Array.isArray(b.region) && b.region.length === ROWS) {
        region = b.region.map((v: any) => {
          const n = Number(v);
          return String(isFinite(n) ? Math.min(16383, Math.max(0, Math.round(n))) : 0);
        });
      }
      const regionFromApp = region !== null;

      const p = "MotionDetect%5B0%5D";
      const setConfig = (params: string[]) =>
        digestGet(
          creds.host,
          cam.http_port || CAMERA_HTTP_PORT,
          creds.user,
          creds.pass,
          `/cgi-bin/configManager.cgi?action=setConfig&${params.join("&")}`,
        );

      // 1) Window[0]: liga, define sensibilidade/limiar e a gravação.
      const r1 = await setConfig([
        `${p}.Enable=${enable}`,
        `${p}.EventHandler.RecordEnable=${recordEnable}`,
        // A câmera (SD) não aceita 0; o latch que vale é o do backend (record_latch).
        `${p}.EventHandler.RecordLatch=${Math.max(1, recordLatch)}`,
        `${p}.EventHandler.Dejitter=${dejitter}`,
        `${p}.MotionDetectWindow%5B0%5D.Sensitive=${sensitive}`,
        `${p}.MotionDetectWindow%5B0%5D.Threshold=${threshold}`,
      ]);
      if (r1.status !== 200 || !/ok/i.test(r1.body)) {
        res.status(502).json({
          message:
            "Não foi possível salvar na câmera. Verifique o IP e a Porta HTTP em ✏️ Editar câmera.",
        });
        return;
      }

      // 2) Aplica a região às janelas. A câmera tem 4 janelas SEMPRE ativas
      //    (motionWindowNum é read-only) e o firmware trata janela com região
      //    vazia como "quadro inteiro". Por isso colocamos a MESMA região (e
      //    sensibilidade) em todas — assim as 4 olham só a área desenhada.
      //    Uma requisição por janela (evita URL longo demais → socket hang up).
      let mirroredRegion = false;
      try {
        // Se a região não veio do app, lê a que já está na Window[0] da câmera.
        if (!region) {
          const cur = await digestGet(
            creds.host,
            cam.http_port || CAMERA_HTTP_PORT,
            creds.user,
            creds.pass,
            "/cgi-bin/configManager.cgi?action=getConfig&name=MotionDetect",
          );
          if (cur.status === 200) {
            region = [];
            for (let i = 0; i < ROWS; i++) {
              const m = cur.body.match(
                new RegExp(
                  `MotionDetectWindow\\[0\\]\\.Region\\[${i}\\]=(\\d+)`,
                ),
              );
              region[i] = m ? m[1] : "0";
            }
          }
        }
        if (region) {
          // A câmera derruba a conexão (socket hang up) se o URL do setConfig
          // ficar longo (~1 KB). Por isso a região vai em PEDAÇOS pequenos
          // (poucos índices por requisição). Escrevemos a mesma região nas 4
          // janelas (janela com região vazia = quadro inteiro nesse firmware).
          const CHUNK = 6;
          const windows = regionFromApp ? [0, 1, 2, 3] : [1, 2, 3];
          let allOk = true;
          for (const w of windows) {
            const win = `${p}.MotionDetectWindow%5B${w}%5D`;
            // sensibilidade/limiar (request curto, separado)
            const rs = await setConfig([
              `${win}.Sensitive=${sensitive}`,
              `${win}.Threshold=${threshold}`,
            ]);
            if (!(rs.status === 200 && /ok/i.test(rs.body))) allOk = false;
            // região em blocos de CHUNK índices
            for (let start = 0; start < ROWS; start += CHUNK) {
              const params: string[] = [];
              for (let i = start; i < Math.min(ROWS, start + CHUNK); i++) {
                params.push(`${win}.Region%5B${i}%5D=${region[i]}`);
              }
              const rw = await setConfig(params);
              if (!(rw.status === 200 && /ok/i.test(rw.body))) allOk = false;
            }
          }
          mirroredRegion = allOk;
        }
      } catch (e: any) {
        console.error("setMotionDetect (region):", e?.message);
      }

      // Relê a região aplicada na Window[0] (diagnóstico: confirma se persistiu).
      let regionApplied: number[] | undefined;
      try {
        const chk = await digestGet(
          creds.host,
          cam.http_port || CAMERA_HTTP_PORT,
          creds.user,
          creds.pass,
          "/cgi-bin/configManager.cgi?action=getConfig&name=MotionDetect",
        );
        if (chk.status === 200) {
          regionApplied = [];
          for (let i = 0; i < ROWS; i++) {
            const m = chk.body.match(
              new RegExp(`MotionDetectWindow\\[0\\]\\.Region\\[${i}\\]=(\\d+)`),
            );
            regionApplied.push(m ? Number(m[1]) : 0);
          }
          console.log(
            `setMotionDetect region enviada=[${(region || []).join(",")}] aplicada=[${regionApplied.join(",")}]`,
          );
        }
      } catch {
        /* diagnóstico apenas */
      }

      res.json({
        ok: true,
        enable,
        recordEnable,
        recordLatch,
        sensitive,
        threshold,
        mirroredRegion,
        regionApplied,
      });
    } catch (e: any) {
      console.error("setMotionDetect:", e?.message);
      res.status(502).json({
        message:
          "Não foi possível salvar na câmera. Verifique o IP e a Porta HTTP em ✏️ Editar câmera.",
      });
    }
  }

  // Campos de imagem (VideoColor[0][0]) que expomos. Cada um 0..100.
  private static readonly IMAGE_FIELDS: { key: string; cam: string }[] = [
    { key: "brightness", cam: "Brightness" },
    { key: "contrast", cam: "Contrast" },
    { key: "saturation", cam: "Saturation" },
    { key: "hue", cam: "Hue" },
    { key: "sharpness", cam: "Sharpness" },
  ];

  /** Lê os ajustes de imagem da câmera (VideoColor) — só os campos existentes. */
  public async getImage(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const creds = parseRtspCreds(cam.rtsp_url);
      if (!creds) {
        res.status(400).json({ message: "URL da câmera inválida." });
        return;
      }
      const { status, body } = await digestGet(
        creds.host,
        cam.http_port || CAMERA_HTTP_PORT,
        creds.user,
        creds.pass,
        "/cgi-bin/configManager.cgi?action=getConfig&name=VideoColor",
      );
      if (status !== 200) {
        res.status(502).json({ message: "Não foi possível ler a imagem da câmera." });
        return;
      }
      const image: Record<string, number> = {};
      for (const f of Camera.IMAGE_FIELDS) {
        const m = body.match(
          new RegExp(`VideoColor\\[0\\]\\[0\\]\\.${f.cam}=(\\d+)`),
        );
        if (m) image[f.key] = Number(m[1]);
      }
      res.json(image);
    } catch (e: any) {
      console.error("getImage:", e?.message);
      res.status(502).json({ message: "Não foi possível ler a imagem da câmera." });
    }
  }

  /** Grava os ajustes de imagem (VideoColor) — só os campos enviados. */
  public async setImage(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const creds = parseRtspCreds(cam.rtsp_url);
      if (!creds) {
        res.status(400).json({ message: "URL da câmera inválida." });
        return;
      }
      const b = req.body || {};
      const params: string[] = [];
      for (const f of Camera.IMAGE_FIELDS) {
        if (b[f.key] === undefined) continue;
        const n = Number(b[f.key]);
        if (!isFinite(n)) continue;
        const v = Math.min(100, Math.max(0, Math.round(n)));
        params.push(`VideoColor%5B0%5D%5B0%5D.${f.cam}=${v}`);
      }
      if (!params.length) {
        res.json({ ok: true });
        return;
      }
      const { status, body } = await digestGet(
        creds.host,
        cam.http_port || CAMERA_HTTP_PORT,
        creds.user,
        creds.pass,
        `/cgi-bin/configManager.cgi?action=setConfig&${params.join("&")}`,
      );
      if (status !== 200 || !/ok/i.test(body)) {
        res.status(502).json({ message: "A câmera recusou os ajustes de imagem." });
        return;
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("setImage:", e?.message);
      res.status(502).json({ message: "Não foi possível salvar a imagem na câmera." });
    }
  }

  /**
   * Log de debug da detecção de movimento (eventos que chegam da câmera +
   * estado da conexão e da gravação). Usado pelo painel de debug — exposto só
   * via localhost (ver guarda na rota).
   */
  public async getMotionDebug(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      res.json(CameraIvsService.getDebug(cam.path_name));
    } catch (e: any) {
      console.error("getMotionDebug:", e?.message);
      res.status(500).json({ message: "Erro ao obter debug." });
    }
  }

  /** Snapshot JPEG da câmera (fundo para o editor de região de movimento). */
  public async getSnapshot(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const creds = parseRtspCreds(cam.rtsp_url);
      if (!creds) {
        res.status(400).json({ message: "URL da câmera inválida." });
        return;
      }
      const { status, buffer, contentType } = await digestGetRaw(
        creds.host,
        cam.http_port || CAMERA_HTTP_PORT,
        creds.user,
        creds.pass,
        "/cgi-bin/snapshot.cgi?channel=1",
      );
      if (status !== 200 || !buffer.length) {
        res.status(502).json({ message: "Não foi possível obter o snapshot." });
        return;
      }
      res.set("Content-Type", contentType || "image/jpeg");
      res.set("Cache-Control", "no-store");
      res.send(buffer);
    } catch (e: any) {
      console.error("getSnapshot:", e?.message);
      res.status(502).json({ message: "Não foi possível obter o snapshot." });
    }
  }

  /**
   * Dump CRU da config de detecção de movimento direto da câmera
   * (getConfig&name=MotionDetect), incluindo a região (Region). Usado para
   * inspecionar o formato real do modelo. Exposto só via localhost.
   */
  public async getMotionConfigRaw(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const repo = AppDataSource.getRepository(CameraEntity);
      const cam = await repo.findOne({ where: { id, cliente_id: cid } });
      if (!cam) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      const creds = parseRtspCreds(cam.rtsp_url);
      if (!creds) {
        res.status(400).json({ message: "URL da câmera inválida." });
        return;
      }
      const { status, body } = await digestGet(
        creds.host,
        cam.http_port || CAMERA_HTTP_PORT,
        creds.user,
        creds.pass,
        "/cgi-bin/configManager.cgi?action=getConfig&name=MotionDetect",
      );
      res.json({ status, raw: body });
    } catch (e: any) {
      console.error("getMotionConfigRaw:", e?.message);
      res.status(502).json({ message: "Não foi possível ler a config da câmera." });
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
      CameraIvsService.stopCamera(cam.path_name);
      try {
        await MediaMtxService.removePath(cam.path_name);
      } catch (e: any) {
        console.error("removePath:", e?.message);
      }
      await repo.delete(id);
      // Apaga as gravações do disco junto com a câmera.
      deleteCameraRecordings(cam.path_name);
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

  /** Consumo de armazenamento do cliente (usado x cota de 5 GB). */
  public async getStorage(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      // Aplica a cota antes de reportar: se estiver acima de 5 GB, apaga as
      // gravações mais antigas e então devolve o uso já dentro do limite.
      await CameraStorageService.enforceQuotaForCliente(cid);
      const usage = await CameraStorageService.getClienteUsage(cid);
      res.json(usage);
    } catch (e: any) {
      console.error("getStorage:", e?.message);
      res.status(500).json({ message: "Erro ao obter uso de armazenamento." });
    }
  }

  // ===================== PASTA DE GRAVAÇÕES (arquivos no disco) =====================

  /** Lista os arquivos .mp4 gravados da câmera (pasta no disco). */
  public async listFiles(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const info = await getCameraDir(cid, id);
      if (!info) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      if (!fs.existsSync(info.dir)) {
        res.json({ items: [] });
        return;
      }
      // As gravações ficam em subpastas (recordPath: %path/%Y-%m/%d/...).
      // `dir` é a subpasta relativa, ex: "2026-06/08" ("" para arquivos antigos,
      // gravados direto na pasta da câmera). Varre recursivamente (qualquer nível).
      const items: { name: string; dir: string; size: number; mtime: Date }[] = [];
      const walk = (absDir: string, relDir: string) => {
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(absDir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const abs = path.join(absDir, entry.name);
          if (entry.isDirectory()) {
            walk(abs, relDir ? `${relDir}/${entry.name}` : entry.name);
          } else if (entry.isFile() && entry.name.endsWith(".mp4")) {
            try {
              const st = fs.statSync(abs);
              items.push({ name: entry.name, dir: relDir, size: st.size, mtime: st.mtime });
            } catch {
              /* removido entre o readdir e o stat — ignora */
            }
          }
        }
      };
      walk(info.dir, "");
      items.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      res.json({ items });
    } catch (e: any) {
      console.error("listFiles:", e?.message);
      res.status(500).json({ message: "Erro ao listar arquivos." });
    }
  }

  /** Serve um arquivo de gravação (com suporte a Range para seek no vídeo). */
  public async getFile(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      // Caminho relativo (subpasta + arquivo), ex: "2026-06/08/14-43-19.mp4".
      // Funciona para qualquer profundidade e para gravações antigas (sem subpasta).
      const rel = String((req.params as any)[0] || "");
      const info = await getCameraDir(cid, id);
      if (!info) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      // Resolve e garante que continua dentro da pasta da câmera (anti path traversal).
      const baseResolved = path.resolve(info.dir);
      const filePath = path.resolve(baseResolved, rel);
      if (
        filePath !== baseResolved &&
        !filePath.startsWith(baseResolved + path.sep)
      ) {
        res.status(404).json({ message: "Arquivo não encontrado." });
        return;
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.status(404).json({ message: "Arquivo não encontrado." });
        return;
      }
      // acceptRanges:false → ignora o header Range e manda o arquivo .mp4 INTEIRO
      // numa única resposta 200 (sem 206/streaming em pedaços). Como os segmentos
      // são curtos (~1 min, poucos MB), é mais rápido entregar o arquivo completo
      // de uma vez do que o navegador ficar fatiando em dezenas de Range requests.
      // Express trata Content-Type (.mp4 → video/mp4) e ETag automaticamente.
      // O callback captura erros assíncronos do envio (ex.: EACCES = sem permissão
      // de leitura no arquivo gravado pelo container; ENOENT = removido na hora).
      res.sendFile(filePath, { acceptRanges: false }, (err: any) => {
        if (err) {
          console.error(
            "getFile sendFile:",
            err?.code || "",
            err?.message,
            filePath,
          );
          if (!res.headersSent) {
            res.status(500).json({ message: "Erro ao servir arquivo." });
          }
        }
      });
    } catch (e: any) {
      console.error("getFile:", e?.message);
      if (!res.headersSent) res.status(500).json({ message: "Erro ao servir arquivo." });
    }
  }

  /** Apaga uma gravação. Remove também as subpastas que ficarem vazias. */
  public async deleteFile(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const rel = String((req.params as any)[0] || "");
      const info = await getCameraDir(cid, id);
      if (!info) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      // Resolve e garante que continua dentro da pasta da câmera (anti path traversal).
      const baseResolved = path.resolve(info.dir);
      const filePath = path.resolve(baseResolved, rel);
      if (
        filePath === baseResolved ||
        !filePath.startsWith(baseResolved + path.sep)
      ) {
        res.status(404).json({ message: "Arquivo não encontrado." });
        return;
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.status(404).json({ message: "Arquivo não encontrado." });
        return;
      }

      fs.rmSync(filePath, { force: true });

      // Sobe removendo as pastas que ficaram vazias, sem passar da pasta da câmera.
      let dir = path.dirname(filePath);
      while (dir !== baseResolved && dir.startsWith(baseResolved + path.sep)) {
        try {
          if (fs.readdirSync(dir).length > 0) break;
          fs.rmdirSync(dir);
        } catch {
          break;
        }
        dir = path.dirname(dir);
      }

      res.json({ ok: true });
    } catch (e: any) {
      console.error("deleteFile:", e?.message);
      res.status(500).json({ message: "Erro ao apagar gravação." });
    }
  }

  /** Limpa uma pasta de gravações inteira (ex.: o dia "2026-06/08"). */
  public async clearFolder(req: Request, res: Response) {
    try {
      const cid = req.cameraCliente!.id!;
      const id = Number(req.params.id);
      const rel = String((req.params as any)[0] || "");
      if (!rel) {
        res.status(400).json({ message: "Pasta não informada." });
        return;
      }
      const info = await getCameraDir(cid, id);
      if (!info) {
        res.status(404).json({ message: "Câmera não encontrada." });
        return;
      }
      // Resolve e garante que continua dentro da pasta da câmera (anti traversal).
      // Não permite apagar a própria pasta-raiz da câmera (rel vazio já barrado).
      const baseResolved = path.resolve(info.dir);
      const target = path.resolve(baseResolved, rel);
      if (target === baseResolved || !target.startsWith(baseResolved + path.sep)) {
        res.status(404).json({ message: "Pasta não encontrada." });
        return;
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
        res.status(404).json({ message: "Pasta não encontrada." });
        return;
      }

      fs.rmSync(target, { recursive: true, force: true });

      // Remove as pastas-pai que ficarem vazias (ex.: o mês, ao apagar o dia).
      let dir = path.dirname(target);
      while (dir !== baseResolved && dir.startsWith(baseResolved + path.sep)) {
        try {
          if (fs.readdirSync(dir).length > 0) break;
          fs.rmdirSync(dir);
        } catch {
          break;
        }
        dir = path.dirname(dir);
      }

      res.json({ ok: true });
    } catch (e: any) {
      console.error("clearFolder:", e?.message);
      res.status(500).json({ message: "Erro ao limpar pasta." });
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
