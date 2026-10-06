import { Router } from "express";

import { protegido } from "../middleware/PermissionGuard";
import { semAuditoria } from "../utils/auditoria";
import NFEController from "../controller/NFE";

const nfe = new NFEController();

const router: Router = Router();

// Níveis iguais aos das telas no frontend (App.tsx): operador = 2, admin = 5.
const operador = protegido(2);
const admin = protegido(5);

// router.post("/emitirNFE", operador, nfe.emitirNFE);
// router.post("/buscarNFE", operador, nfe.buscarNFE);
router.post("/buscarClientes", operador, semAuditoria, nfe.BuscarClientes);
router.post("/buscarAtivos", operador, semAuditoria, nfe.BuscarAtivos);
router.post("/buscarGeradas", operador, semAuditoria, nfe.BuscarNFEs);
router.get("/xml/:chave", operador, nfe.downloadXml);
// router.post("/cancelarNFE", operador, nfe.cancelarNFE);
// router.post("/statusJob", operador, nfe.getStatusJob);

router.post("/comodato/saida", operador, nfe.emitirSaidaComodato);
router.post("/comodato/entrada", operador, nfe.emitirEntradaComodato);
router.post("/comodato/devolucao", operador, nfe.devolucaoComodato);
router.post("/cancelar", admin, nfe.cancelarNota);
router.post("/cancelarNotas", admin, nfe.cancelarNotas);

router.post("/generateReportPdf", operador, semAuditoria, nfe.generateReportPdf);
router.post("/generateDanfe", operador, semAuditoria, nfe.generatePdfFromNfXML);
router.post("/generateExcel", operador, nfe.generateExcel);
router.post("/downloadZipXMLs", operador, semAuditoria, nfe.baixarZipXml);

export default router;
