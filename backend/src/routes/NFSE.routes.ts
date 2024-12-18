import { Router } from "express";

import NFSE from "../controller/NFSE";
import AuthGuard from "../middleware/AuthGuard";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../files"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `certificado.pfx`);
  },
});

const upload = multer({ storage: storage });

const router: Router = Router();

router.get("/", AuthGuard, NFSE.create);
router.post("/upload", upload.any(), AuthGuard, NFSE.uploadCertificado);

export default router;
