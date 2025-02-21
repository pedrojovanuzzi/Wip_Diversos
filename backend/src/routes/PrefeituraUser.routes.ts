import { Router } from "express";
import PrefeituraLogin from "../controller/PrefeituraLogin";
const router: Router = Router()

//Routes
router.post("/Login", PrefeituraLogin.login);


export default router;