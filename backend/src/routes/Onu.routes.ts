import {Router} from "express"
import AuthGuard from "../middleware/AuthGuard";
import Onu from "../controller/Onu";

const onu = new Onu();

// import 
const router: Router = Router();

router.post("/OnuAuthentication", AuthGuard, onu.onuAuthentication);
router.post("/OnuShowOnline", AuthGuard, onu.onuShowOnline);


export default router;