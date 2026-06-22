import { Router } from "express";
import Camera from "../controller/Camera";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

// ---- Setup (público, via UUID) ----
// O cliente define e-mail + senha a partir do link gerado pelo admin.
router.get("/setup/:uuid", Camera.getSetup);
router.post("/setup/:uuid", Camera.definirSenha);

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

export default router;
