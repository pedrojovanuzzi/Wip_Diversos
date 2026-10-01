import { Router } from "express";
import AuditoriaController from "../controller/Auditoria";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

// Quem fez o quê no sistema: só administradores consultam.
const somenteAdmin = (req: any, res: any, next: any) => {
  if ((req.user?.permission ?? 0) < 5) {
    res.status(403).json({ message: "Permissão insuficiente." });
    return;
  }
  next();
};

router.get("/", AuthGuard, somenteAdmin, (req, res) =>
  AuditoriaController.listar(req, res),
);
router.get("/filtros", AuthGuard, somenteAdmin, (req, res) =>
  AuditoriaController.filtros(req, res),
);

export default router;
