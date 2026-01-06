import { Router } from "express";
import Whatsapp from "../controller/WhatsConversationPath";

const router: Router = Router();

//Routes
router.post("/", Whatsapp.index);
router.get("/", Whatsapp.index);

export default router;
