import { Router } from "express";

import AuthGuard from "../middleware/AuthGuard";
import NFEController from "../controller/NFE";

const nfe = new NFEController();

const router: Router = Router();

// router.post("/emitirNFE", AuthGuard, nfe.emitirNFE);
// router.post("/buscarNFE", AuthGuard, nfe.buscarNFE);
// router.post("/buscarClientes", AuthGuard, nfe.BuscarClientes);
// router.post("/cancelarNFE", AuthGuard, nfe.cancelarNFE);
// router.post("/statusJob", AuthGuard, nfe.getStatusJob);

router.post("/comodato/saida", AuthGuard, nfe.emitirSaidaComodato);
router.post("/comodato/entrada", AuthGuard, nfe.emitirEntradaComodato);

export default router;
