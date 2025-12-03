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

export default router;
