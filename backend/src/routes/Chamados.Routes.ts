import { Router } from "express";
import Chamados from "../controller/Chamados";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()

//Routes
router.get("/", AuthGuard, Chamados.showMonth);
router.get("/year", AuthGuard, Chamados.showYear);
router.get("/all", AuthGuard, Chamados.showAll);

export default router;