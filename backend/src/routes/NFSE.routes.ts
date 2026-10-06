import { Router } from "express";

import NFSE from "../controller/NFSE";
import { protegido } from "../middleware/PermissionGuard";
import { semAuditoria } from "../utils/auditoria";
import multer from "multer";
import path from "path";

// O certificado fica em memória (são poucos KB) e o controller mesmo grava o
// arquivo temporário que vai validar. Com diskStorage, no Windows, o multer
// chama o handler no evento "finish" — antes de o descritor fechar — e a
// validação esbarrava em "O arquivo já está sendo usado por outro processo".
// De quebra, nada toca o disco antes de o arquivo ser aprovado.
const storage = multer.memoryStorage();

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // .pfx e .p12 são o mesmo formato (PKCS#12); as certificadoras entregam ora
  // com uma extensão, ora com a outra.
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".pfx" || ext === ".p12") {
    cb(null, true);
  } else {
    cb(new Error("Envie o certificado A1 em .pfx ou .p12."));
  }
};

// 5 MB é folga larga para um A1 (costuma ter poucos KB).
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router: Router = Router();

// Níveis iguais aos das telas no frontend (App.tsx): operador = 2, admin = 5.
const operador = protegido(2);
const admin = protegido(5);

router.post("/", operador, NFSE.iniciar.bind(NFSE));
// router.post('/cancelar', NFSE.cancelarRPS.bind(NFSE));
// router.get('/consultar', NFSE.consultarRPS.bind(NFSE));

router.post("/BuscarClientes", operador, semAuditoria, NFSE.BuscarClientes);

router.post("/cancelarNfse", admin, NFSE.cancelarNfse.bind(NFSE));

router.post("/BuscarNSFE", operador, semAuditoria, NFSE.BuscarNSFE);
router.get("/ultimoRps", operador, NFSE.ultimoRps);

router.post("/GerarNfseAvulsa", operador, NFSE.GerarNfseAvulsa);

router.post("/BuscarClientesServicos", operador, semAuditoria, NFSE.BuscarClientesServicos);
router.post("/EmitirNfseServicos", operador, NFSE.EmitirNfseServicos);

router.post("/imprimirNFSE", operador, NFSE.imprimirNFSE);

router.post("/setSessionPassword", operador, NFSE.setPassword);

// AuthGuard ANTES do multer — na ordem anterior o arquivo era gravado em disco
// mesmo sem token válido.
router.post("/upload", operador, upload.any(), NFSE.uploadCertificado);

export default router;
