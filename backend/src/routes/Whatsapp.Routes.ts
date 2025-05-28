import { Router } from "express";
import Whatsapp from "../controller/Whatsapp";

const router: Router = Router()

//Routes
router.get("/conversations", Whatsapp.receiveUsers);


export default router;