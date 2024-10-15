import { Router } from "express";
import Chamados from "../controller/Chamados";

const router: Router = Router()

//Routes
router.get("/", Chamados.show);

export default router;