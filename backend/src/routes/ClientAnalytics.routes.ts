import { Router } from "express";
import ClientAnalytics from "../controller/ClientAnalytics";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()


router.post("/info", AuthGuard, ClientAnalytics.info);
router.post("/Desconections", AuthGuard, ClientAnalytics.desconections);
router.post("/SinalOnu", AuthGuard, ClientAnalytics.onuSinal);

export default router;