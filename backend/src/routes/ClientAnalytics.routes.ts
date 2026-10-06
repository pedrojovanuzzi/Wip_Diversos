import { Router } from "express";
import ClientAnalytics from "../controller/ClientAnalytics";
import AuthGuard from "../middleware/AuthGuard";
import { protegido } from "../middleware/PermissionGuard";

const router: Router = Router()

// Níveis iguais aos das telas no frontend (App.tsx): operador = 2, admin = 5.
const operador = protegido(2);


router.post("/info", operador, ClientAnalytics.info);
router.post("/Desconections", operador, ClientAnalytics.desconections);
router.post("/SinalOnu", AuthGuard, ClientAnalytics.onuSinal);
router.post("/Mikrotik", operador, ClientAnalytics.mikrotik);
router.post("/TempoReal", operador, ClientAnalytics.mikrotikTempoReal);
router.post("/Reset", operador, ClientAnalytics.onuReiniciar);
router.get("/ClientList", operador, ClientAnalytics.clientList);
router.post("/HuaweiUptime", operador, ClientAnalytics.huaweiUptime);
router.get("/ClientsWithoutQueue", operador, ClientAnalytics.clientsWithoutQueue);
router.post("/Observacao", operador, ClientAnalytics.observacao);
router.post("/SubirCliente", operador, ClientAnalytics.subirCliente);
router.post("/DerrubarPppoe", operador, ClientAnalytics.derrubarPppoe);
router.post("/MkauthLogin", operador, ClientAnalytics.mkauthLogin);
router.post("/RepararMkauth", operador, ClientAnalytics.repararMkauth);
router.get("/Logs", operador, ClientAnalytics.pppoesLogs);
router.get("/Consumo", operador, ClientAnalytics.consumo);
router.post("/Monitor/Start", operador, ClientAnalytics.monitorStart);
router.post("/Monitor/:id/Stop", operador, ClientAnalytics.monitorStop);
router.get("/Monitor", operador, ClientAnalytics.monitorList);
router.get("/Monitor/:id", operador, ClientAnalytics.monitorDetail);

export default router;