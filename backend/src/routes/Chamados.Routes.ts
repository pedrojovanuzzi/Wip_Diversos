import { Router } from "express";
import Chamados from "../controller/Chamados";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()

//Routes
router.get("/", AuthGuard, Chamados.show);

export default router;