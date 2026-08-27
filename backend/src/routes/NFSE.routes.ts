import { Router } from "express";

import NFSE from "../controller/NFSE";
import AuthGuard from "../middleware/AuthGuard";
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
  cb: multer.FileFilterCallback
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
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const router: Router = Router();

router.post("/", NFSE.iniciar.bind(NFSE));
// router.post('/cancelar', NFSE.cancelarRPS.bind(NFSE));
// router.get('/consultar', NFSE.consultarRPS.bind(NFSE));

router.post("/BuscarClientes", AuthGuard, NFSE.BuscarClientes);

router.post("/cancelarNfse", AuthGuard, NFSE.cancelarNfse.bind(NFSE));

router.post("/BuscarNSFE", AuthGuard, NFSE.BuscarNSFE);

router.post("/GerarNfseAvulsa", AuthGuard, NFSE.GerarNfseAvulsa);

router.post("/BuscarClientesServicos", AuthGuard, NFSE.BuscarClientesServicos);
router.post("/EmitirNfseServicos", AuthGuard, NFSE.EmitirNfseServicos);

router.post("/imprimirNFSE", AuthGuard, NFSE.imprimirNFSE);

router.post("/setSessionPassword", AuthGuard, NFSE.setPassword);

// AuthGuard ANTES do multer — na ordem anterior o arquivo era gravado em disco
// mesmo sem token válido.
router.post("/upload", AuthGuard, upload.any(), NFSE.uploadCertificado);

export default router;
