import { Router } from "express";
import Camera from "../controller/Camera";
import CameraAuth from "../controller/CameraAuth";
import AuthGuard from "../middleware/AuthGuard";
import CameraClientGuard from "../middleware/CameraClientGuard";

const router: Router = Router();

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
router.put("/admin/clientes/:id", AuthGuard, Camera.updateCliente);
router.delete("/admin/clientes/:id", AuthGuard, Camera.removerCliente);

// ---- Cliente (portal) ----
router.get("/me", CameraClientGuard, CameraAuth.me);
router.get("/storage", CameraClientGuard, Camera.getStorage);
router.get("/cameras", CameraClientGuard, Camera.listarCameras);
router.post("/cameras", CameraClientGuard, Camera.addCamera);
router.put("/cameras/:id", CameraClientGuard, Camera.editCamera);
router.delete("/cameras/:id", CameraClientGuard, Camera.removeCamera);
router.get("/cameras/:id/stream", CameraClientGuard, Camera.getStream);
router.get("/cameras/:id/recordings", CameraClientGuard, Camera.listRecordings);
router.get(
  "/cameras/:id/recordings/playback",
  CameraClientGuard,
  Camera.getRecordingPlayback,
);
router.get("/cameras/:id/files", CameraClientGuard, Camera.listFiles);
router.get("/cameras/:id/files/:filename", CameraClientGuard, Camera.getFile);

export default router;
