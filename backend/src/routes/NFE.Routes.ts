import { Router } from "express";

import AuthGuard from "../middleware/AuthGuard";
import NFEController from "../controller/NFE";

const nfe = new NFEController();

const router: Router = Router();

// router.post("/emitirNFE", AuthGuard, nfe.emitirNFE);
// router.post("/buscarNFE", AuthGuard, nfe.buscarNFE);
router.post("/buscarClientes", AuthGuard, nfe.BuscarClientes);
router.post("/buscarAtivos", AuthGuard, nfe.BuscarAtivos);
router.post("/buscarGeradas", AuthGuard, nfe.BuscarNFEs);
router.get("/xml/:chave", AuthGuard, nfe.downloadXml);
// router.post("/cancelarNFE", AuthGuard, nfe.cancelarNFE);
// router.post("/statusJob", AuthGuard, nfe.getStatusJob);

router.post("/comodato/saida", AuthGuard, nfe.emitirSaidaComodato);
router.post("/comodato/entrada", AuthGuard, nfe.emitirEntradaComodato);
router.post("/cancelar", AuthGuard, nfe.cancelarNota);

router.post("/generateReportPdf", AuthGuard, nfe.generateReportPdf);
router.post("/generateDanfe", AuthGuard, nfe.generatePdfFromNfXML);
router.post("/downloadZipXMLs", AuthGuard, nfe.baixarZipXml);

export default router;
