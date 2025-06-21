import { Router } from "express";
import ClientAnalytics from "../controller/ClientAnalytics";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()


router.post("/info", AuthGuard, ClientAnalytics.info);
router.post("/Desconections", AuthGuard, ClientAnalytics.desconections);
router.post("/SinalOnu", AuthGuard, ClientAnalytics.onuSinal);
router.post("/Mikrotik", AuthGuard, ClientAnalytics.mikrotik);
router.post("/TempoReal", AuthGuard, ClientAnalytics.mikrotikTempoReal);
router.post("/Reset", AuthGuard, ClientAnalytics.onuReiniciar);

export default router;