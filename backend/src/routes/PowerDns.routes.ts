import {Router} from "express"
import AuthGuard from "../middleware/AuthGuard";
import PowerDNS from "../controller/PowerDns";

import path from "path";
import multer from "multer";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "..", '..', "uploads"));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const nomeFinal = 'DnsPdf.pdf';
        cb(null, nomeFinal);
    }
})

const upload = multer({storage});


const powerdns = new PowerDNS();

// import 
const router: Router = Router();

router.post("/inserirPdf", AuthGuard, upload.single("file"), powerdns.inserirPdf.bind(powerdns));


export default router;