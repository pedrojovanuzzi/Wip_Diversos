import { Router, Request, Response, NextFunction } from "express";
import Camera from "../controller/Camera";
import CameraAuth from "../controller/CameraAuth";
import AuthGuard from "../middleware/AuthGuard";
import CameraClientGuard from "../middleware/CameraClientGuard";

const router: Router = Router();

/**
 * Libera a rota só quando acessada por localhost (ferramenta de debug em dev).
 * Baseia-se no Host enviado pelo cliente (não no IP do socket, que atrás de um
 * proxy reverso seria sempre 127.0.0.1). Em produção o Host é o domínio → 404.
 */
function localhostOnly(req: Request, res: Response, next: NextFunction) {
  const host = (req.hostname || "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    next();
    return;
  }
  res.status(404).json({ message: "Não encontrado." });
}

// ---- Públicas ----
router.post("/login", CameraAuth.login);
router.get("/setup/:uuid", Camera.getSetup);
router.post("/setup/:uuid", Camera.definirSenha);
// Chamado pelo MediaMTX (authMethod: http). Aceita GET e POST.
router.post("/mediamtx-auth", Camera.mediamtxAuth);
router.get("/mediamtx-auth", Camera.mediamtxAuth);

// ---- Admin (operador interno) ----
router.get("/admin/nginx/status", AuthGuard, Camera.nginxStatus);
router.post("/admin/nginx/apply", AuthGuard, Camera.nginxApply);
router.get("/admin/sis-clientes", AuthGuard, Camera.buscarSisClientes);
router.post("/admin/clientes", AuthGuard, Camera.criarCliente);
router.post("/admin/clientes/ensure", AuthGuard, Camera.ensureCliente);
router.get("/admin/clientes", AuthGuard, Camera.listarClientes);
router.post("/admin/clientes/:id/regenerar", AuthGuard, Camera.regenerarLink);
router.put("/admin/clientes/:id/status", AuthGuard, Camera.toggleStatusCliente);
router.put("/admin/clientes/:id/plano", AuthGuard, Camera.updatePlano);
router.put("/admin/clientes/:id", AuthGuard, Camera.updateCliente);
router.delete("/admin/clientes/:id", AuthGuard, Camera.removerCliente);

// ---- Cliente (portal) ----
router.get("/me", CameraClientGuard, CameraAuth.me);
router.get("/storage", CameraClientGuard, Camera.getStorage);
router.get("/cameras", CameraClientGuard, Camera.listarCameras);
router.post("/cameras", CameraClientGuard, Camera.addCamera);
router.get("/cameras/:id", CameraClientGuard, Camera.getCameraDetail);
router.put("/cameras/:id", CameraClientGuard, Camera.editCamera);
router.put("/cameras/:id/recording", CameraClientGuard, Camera.setRecording);
// Detecção de movimento NA CÂMERA (lê/grava a config via configManager.cgi).
router.get("/cameras/:id/motion-detect", CameraClientGuard, Camera.getMotionDetect);
router.put("/cameras/:id/motion-detect", CameraClientGuard, Camera.setMotionDetect);
// Ajustes de imagem da câmera (brilho/contraste/saturação/etc — VideoColor).
router.get("/cameras/:id/image", CameraClientGuard, Camera.getImage);
router.put("/cameras/:id/image", CameraClientGuard, Camera.setImage);
// Snapshot JPEG (fundo do editor de região). Token via query (tag <img>).
router.get("/cameras/:id/snapshot", CameraClientGuard, Camera.getSnapshot);
// Debug da detecção de movimento (eventos vindos da câmera) — só via localhost.
router.get(
  "/cameras/:id/motion-debug",
  localhostOnly,
  CameraClientGuard,
  Camera.getMotionDebug,
);
// Dump cru da config MotionDetect da câmera (inspecionar o Region) — localhost.
router.get(
  "/cameras/:id/motion-config-raw",
  localhostOnly,
  CameraClientGuard,
  Camera.getMotionConfigRaw,
);
router.delete("/cameras/:id", CameraClientGuard, Camera.removeCamera);
router.get("/cameras/:id/stream", CameraClientGuard, Camera.getStream);
router.get("/cameras/:id/recordings", CameraClientGuard, Camera.listRecordings);
router.get(
  "/cameras/:id/recordings/playback",
  CameraClientGuard,
  Camera.getRecordingPlayback,
);
router.get("/cameras/:id/files", CameraClientGuard, Camera.listFiles);
// Apaga as gravações MAIS ANTIGAS da câmera até liberar ~N GB.
router.post("/cameras/:id/files-prune", CameraClientGuard, Camera.pruneOldest);
// Curinga: aceita o caminho relativo da gravação em qualquer profundidade
// (ex: "2026-06/08/arquivo.mp4") e também as antigas, planas. O controller
// valida contra path traversal.
router.get("/cameras/:id/files/*", CameraClientGuard, Camera.getFile);
router.delete("/cameras/:id/files/*", CameraClientGuard, Camera.deleteFile);
// Limpa uma pasta de gravações inteira (ex.: o dia "2026-06/08").
router.delete("/cameras/:id/folder/*", CameraClientGuard, Camera.clearFolder);

export default router;
