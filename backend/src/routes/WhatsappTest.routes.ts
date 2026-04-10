import { Router } from "express";
import AuthGuard from "../middleware/AuthGuard";
import { simulateFlow, listFlows, buscarCliente } from "../controller/whatsapp/handlers/whatsapp-test.controller";

const router: Router = Router();

router.get("/flows", AuthGuard, listFlows);
router.get("/cliente/:login", AuthGuard, buscarCliente);
router.post("/simulate", AuthGuard, simulateFlow);

export default router;
