import { Router } from "express";
import Whatsapp from "../controller/WhatsConversationPath";

const router: Router = Router();

//Routes
router.post("/", Whatsapp.index);
router.get("/", Whatsapp.verify);

router.post("/test", Whatsapp.index);
router.get("/test", Whatsapp.verify);

export default router;
