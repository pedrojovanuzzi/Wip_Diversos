import { Router } from "express";
import ChamadoFichaTecnicaController from "../controller/ChamadoFichaTecnica";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

router.post("/", AuthGuard, (req, res) =>
  ChamadoFichaTecnicaController.create(req, res),
);
router.get("/", AuthGuard, (req, res) =>
  ChamadoFichaTecnicaController.list(req, res),
);
router.get("/by-login/:login", AuthGuard, (req, res) =>
  ChamadoFichaTecnicaController.buscarChamadoPorLogin(req, res),
);
router.get("/:id", AuthGuard, (req, res) =>
  ChamadoFichaTecnicaController.getById(req, res),
);
router.post("/:id/ressincronizar", AuthGuard, (req, res) =>
  ChamadoFichaTecnicaController.ressincronizar(req, res),
);

export default router;
