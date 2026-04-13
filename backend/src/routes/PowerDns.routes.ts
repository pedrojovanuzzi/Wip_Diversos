import { Router } from "express";
import AuthGuard from "../middleware/AuthGuard";
import PowerDNS from "../controller/PowerDns";

import path from "path";
import multer from "multer";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nomeBase = "DnsUpload";
    cb(null, `${nomeBase}${ext}`);
  },
});

const upload = multer({ storage });

const powerdns = new PowerDNS();

const router: Router = Router();

router.post(
  "/inserirPdf",
  AuthGuard,
  upload.single("file"),
  powerdns.inserirPdf.bind(powerdns),
);
router.post(
  "/removerPdf",
  AuthGuard,
  upload.single("file"),
  powerdns.removerPdf.bind(powerdns),
);
router.post(
  "/inserirDominio",
  AuthGuard,
  powerdns.inserirDominio.bind(powerdns),
);
router.get("/obterDominios", AuthGuard, powerdns.obterDominios.bind(powerdns));

export default router;
