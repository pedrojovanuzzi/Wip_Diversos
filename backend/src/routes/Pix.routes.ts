import { Router } from "express";
import Pix from "../controller/Pix";
import AuthGuard from "../middleware/AuthGuard";

const pixController = new Pix();

const router: Router = Router()

//Codigo Legado que foi adaptado para typescript
router.post('/gerador', AuthGuard, pixController.gerarPix);
router.get('/gerador', AuthGuard, pixController.gerarPix);

router.post('/geradorAll', AuthGuard, pixController.gerarPixAll);
router.get('/geradorAll', AuthGuard, pixController.gerarPixAll);

router.post('/geradorAberto', AuthGuard, pixController.gerarPixAberto);
router.get('/geradorAberto', AuthGuard, pixController.gerarPixAberto);

router.post('/geradorTitulos', AuthGuard, pixController.gerarPixVariasContas);
router.get('/geradorTitulos', AuthGuard, pixController.gerarPixVariasContas);

router.post('/criarPixAutomatico', AuthGuard, pixController.PixAutomaticoCriar);
router.post('/criarCobrancaPixAutomatico', AuthGuard, pixController.pegarUltimoBoletoGerarPixAutomaticoSimular);
router.post('/cancelarCobranca', AuthGuard, pixController.cancelarCobranca);


router.post('/criarWebhookPixAutomatico', AuthGuard, pixController.AlterarWebhookPixAutomatico);
router.post('/criarWebhookPixAutomaticoRecurrency', AuthGuard, pixController.AlterarWebhookPixAutomaticoRecorrencia);
router.post('/getPixAutomaticoClients', AuthGuard, pixController.listaPixAutomatico);
router.post('/getPixAutomaticoOneClient', AuthGuard, pixController.listarPixAutomaticoUmCliente);
router.post('/atualizarPixAutomaticoClients', AuthGuard, pixController.atualizarPixAutomatico);

router.post('/simularPagamento', AuthGuard, pixController.simularPagamentoWebhookPixAutomatico);


// router.post('/PixUnicoVencido/webhook', pixController.StatusUpdatePixUnicoVencido);
router.post('/PixTodosVencidos/webhook', pixController.StatusUpdatePixTodosVencidos);
router.post('/PixAutomatico/webhookCobr', pixController.PixAutomaticWebhookCobr);
router.post('/PixAutomatico/webhookRec', pixController.PixAutomaticWebhookRec);


export default router;
