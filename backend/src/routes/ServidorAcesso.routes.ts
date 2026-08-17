import { Router } from "express";
import ServidorAcessoController from "../controller/ServidorAcesso";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

// Credenciais de equipamento: só administradores mexem.
const somenteAdmin = (req: any, res: any, next: any) => {
  if ((req.user?.permission ?? 0) < 5) {
    res.status(403).json({ message: "Permissão insuficiente." });
    return;
  }
  next();
};

router.get("/", AuthGuard, (req, res) =>
  ServidorAcessoController.listar(req, res),
);
router.get("/exportar", AuthGuard, somenteAdmin, (req, res) =>
  ServidorAcessoController.exportar(req, res),
);
router.post("/importar", AuthGuard, somenteAdmin, (req, res) =>
  ServidorAcessoController.importar(req, res),
);
router.post("/", AuthGuard, somenteAdmin, (req, res) =>
  ServidorAcessoController.criar(req, res),
);
router.put("/:id", AuthGuard, somenteAdmin, (req, res) =>
  ServidorAcessoController.atualizar(req, res),
);
router.delete("/:id", AuthGuard, somenteAdmin, (req, res) =>
  ServidorAcessoController.remover(req, res),
);
router.post("/:id/testar", AuthGuard, somenteAdmin, (req, res) =>
  ServidorAcessoController.testar(req, res),
);

export default router;
