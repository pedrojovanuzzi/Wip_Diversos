import { Router } from "express";
import Whatsapp from "../controller/WhatsConversationPath";

const router: Router = Router();

//Routes
router.post("/", Whatsapp.index);
router.get("/", Whatsapp.verify);

router.post("/test", Whatsapp.index);
router.get("/test", Whatsapp.verify);

router.post("/Flow", Whatsapp.Flow);
router.get("/Flow", Whatsapp.Flow);

router.post("/FlowTest", Whatsapp.Flow);
router.get("/FlowTest", Whatsapp.Flow);

export default router;
