import { Router } from "express";
import PrefeituraLogin from "../controller/PrefeituraLogin";
const router: Router = Router()

//Routes
router.post("/Login", PrefeituraLogin.login);
router.post("/redirect", PrefeituraLogin.redirect);
router.get("/redirect", PrefeituraLogin.redirect);
router.post("/redirect_2", PrefeituraLogin.redirect_2);
router.get("/redirect_2", PrefeituraLogin.redirect_2);
router.post("/SendOtp", PrefeituraLogin.SendOtp);
router.post("/Debug", PrefeituraLogin.debug);


export default router;