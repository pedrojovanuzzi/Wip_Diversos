import { Router } from "express";

import NFSE from "../controller/NFSE";
import AuthGuard from "../middleware/AuthGuard";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../files'));
  },
  filename: (req, file, cb) => {
    cb(null, 'certificado.pfx');
  }
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Verifica se a extensão do arquivo é .pfx
  if (path.extname(file.originalname).toLowerCase() === '.pfx') {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos com extensão .pfx são permitidos.'));
  }
};

const upload = multer({ storage, fileFilter });

const router: Router = Router();

router.post('/', NFSE.iniciar.bind(NFSE));
// router.post('/cancelar', NFSE.cancelarRPS.bind(NFSE));
// router.get('/consultar', NFSE.consultarRPS.bind(NFSE));

router.post("/BuscarClientes", AuthGuard, NFSE.BuscarClientes);

router.post("/cancelarNfse", AuthGuard, NFSE.cancelarNfse.bind(NFSE));

router.post("/BuscarNSFE", AuthGuard, NFSE.BuscarNSFE);

router.post("/imprimirNFSE", AuthGuard, NFSE.imprimirNFSE);

router.post("/setSessionPassword", AuthGuard, NFSE.setPassword);

router.post("/upload", upload.any(), AuthGuard, NFSE.uploadCertificado);

export default router;
