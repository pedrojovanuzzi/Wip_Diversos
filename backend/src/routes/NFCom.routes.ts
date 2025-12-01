import { Router } from "express";

import NFCom from "../controller/Nfcom";
import AuthGuard from "../middleware/AuthGuard";
import Nfcom from "../controller/Nfcom";

const nfcom = new Nfcom();

const router: Router = Router();

router.post("/emitirNFCom", AuthGuard, nfcom.gerarNfcom);
router.post("/buscarNFCom", AuthGuard, nfcom.buscarNFCom);
router.post("/buscarClientes", AuthGuard, nfcom.BuscarClientes);

export default router;
