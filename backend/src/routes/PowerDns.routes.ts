import {Router} from "express"
import AuthGuard from "../middleware/AuthGuard";
import PowerDNS from "../controller/PowerDns";

const powerdns = new PowerDNS();

// import 
const router: Router = Router();

router.get("/inserirPdf", AuthGuard, powerdns.inserirPdf);


export default router;