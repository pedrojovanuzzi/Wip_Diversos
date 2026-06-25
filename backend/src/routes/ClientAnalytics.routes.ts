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
router.get("/ClientList", AuthGuard, ClientAnalytics.clientList);
router.get("/ClientsWithoutQueue", AuthGuard, ClientAnalytics.clientsWithoutQueue);
router.post("/Observacao", AuthGuard, ClientAnalytics.observacao);
router.post("/SubirCliente", AuthGuard, ClientAnalytics.subirCliente);
router.post("/DerrubarPppoe", AuthGuard, ClientAnalytics.derrubarPppoe);
router.post("/MkauthLogin", AuthGuard, ClientAnalytics.mkauthLogin);
router.post("/RepararMkauth", AuthGuard, ClientAnalytics.repararMkauth);
router.get("/Logs", AuthGuard, ClientAnalytics.pppoesLogs);

export default router;