import { Router } from "express";

import AuthGuard from "../middleware/AuthGuard";
import { semAuditoria } from "../utils/auditoria";
import NFEController from "../controller/NFE";

const nfe = new NFEController();

const router: Router = Router();

// router.post("/emitirNFE", AuthGuard, nfe.emitirNFE);
// router.post("/buscarNFE", AuthGuard, nfe.buscarNFE);
router.post("/buscarClientes", AuthGuard, semAuditoria, nfe.BuscarClientes);
router.post("/buscarAtivos", AuthGuard, semAuditoria, nfe.BuscarAtivos);
router.post("/buscarGeradas", AuthGuard, semAuditoria, nfe.BuscarNFEs);
router.get("/xml/:chave", AuthGuard, nfe.downloadXml);
// router.post("/cancelarNFE", AuthGuard, nfe.cancelarNFE);
// router.post("/statusJob", AuthGuard, nfe.getStatusJob);

router.post("/comodato/saida", AuthGuard, nfe.emitirSaidaComodato);
router.post("/comodato/entrada", AuthGuard, nfe.emitirEntradaComodato);
router.post("/comodato/devolucao", AuthGuard, nfe.devolucaoComodato);
router.post("/cancelar", AuthGuard, nfe.cancelarNota);
router.post("/cancelarNotas", AuthGuard, nfe.cancelarNotas);

router.post("/generateReportPdf", AuthGuard, semAuditoria, nfe.generateReportPdf);
router.post("/generateDanfe", AuthGuard, semAuditoria, nfe.generatePdfFromNfXML);
router.post("/generateExcel", AuthGuard, nfe.generateExcel);
router.post("/downloadZipXMLs", AuthGuard, semAuditoria, nfe.baixarZipXml);

export default router;
