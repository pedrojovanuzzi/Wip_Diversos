import { Router } from "express";
import { protegido } from "../middleware/PermissionGuard";
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

// Níveis iguais aos das telas no frontend (App.tsx): operador = 2, admin = 5.
const operador = protegido(2);

router.post(
  "/inserirPdf",
  operador,
  upload.single("file"),
  powerdns.inserirPdf.bind(powerdns),
);
router.post(
  "/removerPdf",
  operador,
  upload.single("file"),
  powerdns.removerPdf.bind(powerdns),
);
router.post(
  "/inserirDominio",
  operador,
  powerdns.inserirDominio.bind(powerdns),
);
router.post(
  "/removerDominio",
  operador,
  powerdns.removerDominio.bind(powerdns),
);
router.get("/obterDominios", operador, powerdns.obterDominios.bind(powerdns));

export default router;
