import { Router } from "express";
import Whatsapp from "../controller/Whatsapp";
import AuthGuard from "../middleware/AuthGuard";


const router: Router = Router()

//Routes
router.get("/conversations", AuthGuard, Whatsapp.receiveUsers);
router.post("/conversations", AuthGuard, Whatsapp.changeName);


export default router;