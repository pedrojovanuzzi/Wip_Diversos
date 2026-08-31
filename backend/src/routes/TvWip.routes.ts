import { Router } from "express";
import TvWip from "../controller/TvWip";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

router.get("/", AuthGuard, TvWip.listar);
router.post("/desativar", AuthGuard, TvWip.desativar);
router.post("/reativar", AuthGuard, TvWip.reativar);
router.post("/sincronizar", AuthGuard, TvWip.sincronizar);

export default router;
