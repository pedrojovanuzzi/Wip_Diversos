import {Router} from "express"
import AuthGuard from "../middleware/AuthGuard";
import PowerDNS from "../controller/PowerDns";

import path from "path";
import multer from "multer";

const upload = multer({ dest: path.join(__dirname, "..", "uploads") });


const powerdns = new PowerDNS();

// import 
const router: Router = Router();

router.post("/inserirPdf", AuthGuard, upload.single("file"), powerdns.inserirPdf.bind(powerdns));


export default router;