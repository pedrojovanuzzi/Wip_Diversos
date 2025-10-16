import { Router } from "express";
import Pix from "../controller/Pix";
import AuthGuard from "../middleware/AuthGuard";

const pixController = new Pix();

const router: Router = Router()


router.post('/gerador', AuthGuard, pixController.gerarPix);
router.get('/gerador', AuthGuard, pixController.gerarPix);

router.post('/geradorAll', AuthGuard, pixController.gerarPixAll);
router.get('/geradorAll', AuthGuard, pixController.gerarPixAll);

router.post('/geradorAberto', AuthGuard, pixController.gerarPixAberto);
router.get('/geradorAberto', AuthGuard, pixController.gerarPixAberto);

router.post('/geradorTitulos', AuthGuard, pixController.gerarPixVariasContas);
router.get('/geradorTitulos', AuthGuard, pixController.gerarPixVariasContas);


// router.post('/PixUnicoVencido/webhook', pixController.StatusUpdatePixUnicoVencido);
router.post('/PixTodosVencidos/webhook', pixController.StatusUpdatePixTodosVencidos);


export default router;
