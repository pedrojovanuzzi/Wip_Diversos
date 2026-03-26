import { Router } from "express";
import SolicitacaoServicoController from "../controller/SolicitacaoServico";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

router.get("/", AuthGuard, SolicitacaoServicoController.list);

export default router;
