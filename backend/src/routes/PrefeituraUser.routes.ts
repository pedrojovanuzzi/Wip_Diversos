import { Router } from "express";
import PrefeituraLogin from "../controller/PrefeituraLogin";
const router: Router = Router()

//Routes
router.post("/Login", PrefeituraLogin.login);
router.post("/redirect", PrefeituraLogin.redirect);
router.get("/redirect", PrefeituraLogin.redirect);
router.get("/SendOtp", PrefeituraLogin.SendOtp);


export default router;