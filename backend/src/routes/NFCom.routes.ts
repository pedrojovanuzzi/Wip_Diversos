import { Router } from "express";

import AuthGuard from "../middleware/AuthGuard";
import Nfcom from "../controller/Nfcom";

const nfcom = new Nfcom();

const router: Router = Router();

router.post("/emitirNFCom", AuthGuard, nfcom.gerarNfcom);
router.post("/buscarNFCom", AuthGuard, nfcom.buscarNFCom);
router.post("/buscarClientes", AuthGuard, nfcom.BuscarClientes);
router.post("/cancelarNFCom", AuthGuard, nfcom.cancelarNFcom);
router.post("/statusJob", AuthGuard, nfcom.getStatusJob);
router.post("/generateReportPdf", AuthGuard, nfcom.generateReportPdf);
router.post("/generatePdfFromNfXML", AuthGuard, nfcom.generatePdfFromNfXML);
router.post("/NfComPages", AuthGuard, nfcom.NFComPages);
router.post("/buscarNFComAll", AuthGuard, nfcom.buscarNFComAll);

export default router;
