import { Router } from "express";
import Codef from "../controller/Codef";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

/**
 * Dado econômico-financeiro da empresa inteira — faturamento, folha, dívida.
 * Só administradores veem, na tela e aqui: esconder o menu não adiantaria com
 * a rota aberta.
 */
const somenteAdmin = (req: any, res: any, next: any) => {
  if ((req.user?.permission ?? 0) < 5) {
    res.status(403).json({ message: "Permissão insuficiente." });
    return;
  }
  next();
};

router.get("/", AuthGuard, somenteAdmin, Codef.apurar);
router.get("/exportar", AuthGuard, somenteAdmin, Codef.exportar);
router.get("/plano-contas", AuthGuard, somenteAdmin, Codef.listarRegras);
router.post("/plano-contas", AuthGuard, somenteAdmin, Codef.classificar);
router.delete(
  "/plano-contas/:id",
  AuthGuard,
  somenteAdmin,
  Codef.removerClassificacao,
);
router.post("/competencia", AuthGuard, somenteAdmin, Codef.salvarCompetencia);

export default router;
