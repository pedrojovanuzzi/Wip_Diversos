import { Router } from "express";

import Nfe from "../controller/Nfe";
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

router.get("/", AuthGuard, Nfe.create);
router.post("/upload", upload.any(), AuthGuard, Nfe.uploadCertificado);

export default router;
