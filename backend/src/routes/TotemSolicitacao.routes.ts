import { Router } from "express";
import TotemSolicitacao from "../controller/TotemSolicitacao";

const totemController = new TotemSolicitacao();

const router: Router = Router();

router.post("/registrar", totemController.registrar);

export default router;
