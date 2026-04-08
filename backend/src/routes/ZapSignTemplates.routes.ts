import { Router } from "express";
import ZapSignTemplatesController from "../controller/ZapSignTemplatesController";
import AuthGuard from "../middleware/AuthGuard";

const router = Router();
const controller = new ZapSignTemplatesController();

router.get("/", AuthGuard, controller.listar as any);
router.post("/", AuthGuard, controller.criar as any);
router.put("/:id", AuthGuard, controller.atualizar as any);

export default router;
