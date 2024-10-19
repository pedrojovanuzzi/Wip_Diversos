import { Router } from "express";
import Chamados from "../controller/Chamados";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()

//Routes
router.get("/", AuthGuard, Chamados.showMonth);
router.get("/year", AuthGuard, Chamados.showYear);
router.get("/all", AuthGuard, Chamados.showAll);
router.get("/returns/month", AuthGuard, Chamados.returnMonth);
router.get("/returns/year", AuthGuard, Chamados.returnYear);

export default router;