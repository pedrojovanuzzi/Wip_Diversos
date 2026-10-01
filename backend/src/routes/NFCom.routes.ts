import { Router } from "express";

import AuthGuard from "../middleware/AuthGuard";
import { semAuditoria } from "../utils/auditoria";
import Nfcom from "../controller/Nfcom";

const nfcom = new Nfcom();

const router: Router = Router();

router.post("/emitirNFCom", AuthGuard, nfcom.gerarNfcom);
router.post("/buscarNFCom", AuthGuard, semAuditoria, nfcom.buscarNFCom);
router.post("/buscarClientes", AuthGuard, semAuditoria, nfcom.BuscarClientes);
router.post("/cancelarNFCom", AuthGuard, nfcom.cancelarNFcom);
router.post("/statusJob", AuthGuard, semAuditoria, nfcom.getStatusJob);
router.post("/generateReportPdf", AuthGuard, semAuditoria, nfcom.generateReportPdf);
router.post("/generatePdfFromNfXML", AuthGuard, semAuditoria, nfcom.generatePdfFromNfXML);
router.post("/NfComPages", AuthGuard, nfcom.NFComPages);
router.post("/buscarNFComAll", AuthGuard, semAuditoria, nfcom.buscarNFComAll);
router.post("/downloadZipXMLs", AuthGuard, semAuditoria, nfcom.baixarZipXml);
router.post("/enviarEmailNFCom", AuthGuard, nfcom.enviarEmailNFCom);
router.get(
  "/getNfcomByChaveDeOlhoNoImposto",
  AuthGuard,
  nfcom.getNfcomByChaveDeOlhoNoImposto
);
router.get(
  "/declaracaoQuitacao/declaranteDefaults",
  AuthGuard,
  nfcom.obterDeclaranteDefaults
);
router.post(
  "/declaracaoQuitacao/buscarCliente",
  AuthGuard,
  nfcom.buscarClienteDeclaracao
);
router.post(
  "/declaracaoQuitacao/salvar",
  AuthGuard,
  nfcom.salvarDeclaracaoQuitacao
);
router.get(
  "/declaracaoQuitacao/listar",
  AuthGuard,
  nfcom.listarDeclaracoesQuitacao
);
router.get(
  "/declaracaoQuitacao/:id",
  AuthGuard,
  nfcom.obterDeclaracaoQuitacao
);

export default router;
