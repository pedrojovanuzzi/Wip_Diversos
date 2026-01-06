import { Router } from "express";
import Whatsapp from "../controller/WhatsConversationPath";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

//Routes
router.post("/", AuthGuard, Whatsapp.index);
router.get("/", AuthGuard, Whatsapp.index);

export default router;
