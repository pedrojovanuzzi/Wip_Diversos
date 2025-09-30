import {Router} from "express"
import AuthGuard from "../middleware/AuthGuard";
import Onu from "../controller/Onu";

const onu = new Onu();

// import 
const router: Router = Router();

router.post("/OnuAuthenticationBridge", AuthGuard, onu.onuAuthenticationBridge);
router.post("/OnuAuthenticationWifi", AuthGuard, onu.onuAuthenticationWifi);
router.post("/Desautorize", AuthGuard, onu.Desautorize);
router.post("/Destravar", AuthGuard, onu.Destravar);
router.post("/OnuShowOnline", AuthGuard, onu.onuShowOnline);
router.post("/OnuShowAuth", AuthGuard, onu.onuShowAuth);
router.post("/querySn", AuthGuard, onu.querySn);


export default router;