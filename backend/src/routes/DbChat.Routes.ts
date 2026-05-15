import { Router } from "express";
import DbChat from "../controller/DbChat";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

router.post("/ask", AuthGuard, DbChat.ask);
router.post("/ask/start", AuthGuard, DbChat.start);
router.get("/ask/status", AuthGuard, DbChat.status);

export default router;
