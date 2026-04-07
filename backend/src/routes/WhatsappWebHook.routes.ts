import { Router } from "express";
import Whatsapp from "../controller/whatsapp/index";

const router: Router = Router();

//Routes
router.post("/", Whatsapp.index);
router.get("/", Whatsapp.verify);

router.post("/Flow", Whatsapp.Flow);
router.get("/Flow", Whatsapp.Flow);

export default router;
