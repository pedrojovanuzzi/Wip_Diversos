import { Router } from "express";

import AuthGuard from "../middleware/AuthGuard";
import { protegido } from "../middleware/PermissionGuard";
import { semAuditoria } from "../utils/auditoria";
import Nfcom from "../controller/Nfcom";

const nfcom = new Nfcom();

const router: Router = Router();

// Níveis iguais aos das telas no frontend (App.tsx): operador = 2, admin = 5.
const operador = protegido(2);
const admin = protegido(5);

router.post("/emitirNFCom", operador, nfcom.gerarNfcom);
router.post("/buscarNFCom", AuthGuard, semAuditoria, nfcom.buscarNFCom);
router.post("/buscarClientes", operador, semAuditoria, nfcom.BuscarClientes);
router.post("/cancelarNFCom", admin, nfcom.cancelarNFcom);
router.post("/statusJob", AuthGuard, semAuditoria, nfcom.getStatusJob);
router.post("/generateReportPdf", AuthGuard, semAuditoria, nfcom.generateReportPdf);
router.post("/generatePdfFromNfXML", AuthGuard, semAuditoria, nfcom.generatePdfFromNfXML);
router.post("/NfComPages", AuthGuard, nfcom.NFComPages);
router.post("/buscarNFComAll", AuthGuard, semAuditoria, nfcom.buscarNFComAll);
router.post("/downloadZipXMLs", AuthGuard, semAuditoria, nfcom.baixarZipXml);
router.post("/enviarEmailNFCom", operador, nfcom.enviarEmailNFCom);
router.get(
  "/getNfcomByChaveDeOlhoNoImposto",
  AuthGuard,
  nfcom.getNfcomByChaveDeOlhoNoImposto
);
router.get(
  "/declaracaoQuitacao/declaranteDefaults",
  operador,
  nfcom.obterDeclaranteDefaults
);
router.post(
  "/declaracaoQuitacao/buscarCliente",
  operador,
  nfcom.buscarClienteDeclaracao
);
router.post(
  "/declaracaoQuitacao/salvar",
  operador,
  nfcom.salvarDeclaracaoQuitacao
);
router.get(
  "/declaracaoQuitacao/listar",
  operador,
  nfcom.listarDeclaracoesQuitacao
);
router.get(
  "/declaracaoQuitacao/:id",
  operador,
  nfcom.obterDeclaracaoQuitacao
);

export default router;
