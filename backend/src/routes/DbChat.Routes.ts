import { Router } from "express";
import DbChat from "../controller/DbChat";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

router.post("/ask", AuthGuard, DbChat.ask);

export default router;
