import {Router} from "express"
import { protegido } from "../middleware/PermissionGuard";
import Onu from "../controller/Onu";

const onu = new Onu();

// import 
const router: Router = Router();

// Níveis iguais aos das telas no frontend (App.tsx): operador = 2, admin = 5.
const operador = protegido(2);
const admin = protegido(5);

router.post("/OnuAuthenticationBridge", operador, onu.onuAuthenticationBridge);
router.post("/OnuAuthenticationWifi", operador, onu.onuAuthenticationWifi);
router.post("/Desautorize", operador, onu.Desautorize);
router.post("/Destravar", admin, onu.Destravar);
router.post("/OnuShowOnline", operador, onu.onuShowOnline);
router.post("/OnuShowAuth", operador, onu.onuShowAuth);
router.post("/querySn", operador, onu.querySn);


export default router;