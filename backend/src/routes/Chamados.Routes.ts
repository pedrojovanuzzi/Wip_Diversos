import { Router } from "express";
import Chamados from "../controller/Chamados";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()

//Routes
router.get("/", AuthGuard, Chamados.showMonth);
router.get("/year", AuthGuard, Chamados.showMonth);
router.get("/all", AuthGuard, Chamados.showYear);

export default router;