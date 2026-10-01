import { Router } from "express";
import Whatsapp from "../controller/Whatsapp";
import AuthGuard from "../middleware/AuthGuard";
import { semAuditoria } from "../utils/auditoria";

const router: Router = Router();

//Routes
router.get("/conversations", AuthGuard, Whatsapp.receiveUsers);
router.post("/conversations", AuthGuard, Whatsapp.changeName);

router.post("/conversation", AuthGuard, Whatsapp.receiveUser);
router.get("/Lastconversation", AuthGuard, Whatsapp.getLastMessages);
router.post("/sendMsg", AuthGuard, Whatsapp.sendMessage);
router.post("/broadcast", AuthGuard, Whatsapp.sendBroadcast);
router.post("/clients", AuthGuard, semAuditoria, Whatsapp.searchClients);

export default router;
