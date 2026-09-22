import { Router } from "express";
import Pix from "../controller/Pix";
import AuthGuard from "../middleware/AuthGuard";

const pixController = new Pix();

const router: Router = Router();

//Codigo Legado que foi adaptado para typescript
router.post("/gerador", AuthGuard, pixController.gerarPix);
router.get("/gerador", AuthGuard, pixController.gerarPix);

router.post("/geradorAll", AuthGuard, pixController.gerarPixAll);
router.get("/geradorAll", AuthGuard, pixController.gerarPixAll);

router.post("/geradorAberto", AuthGuard, pixController.gerarPixAberto);
router.get("/geradorAberto", AuthGuard, pixController.gerarPixAberto);

router.post("/geradorTitulos", AuthGuard, pixController.gerarPixVariasContas);
router.get("/geradorTitulos", AuthGuard, pixController.gerarPixVariasContas);

router.post("/criarPixAutomatico", AuthGuard, pixController.PixAutomaticoCriar);
router.post(
  "/criarCobrancaPixAutomatico",
  AuthGuard,
  pixController.pegarUltimoBoletoGerarPixAutomaticoSimular,
);
router.post("/cancelarCobranca", AuthGuard, pixController.cancelarCobranca);
router.post("/buscarCobranca", AuthGuard, pixController.buscarCobranca);
router.post(
  "/listarCobrancasPixAutomatico",
  AuthGuard,
  pixController.listarCobrancasPixAutomatico,
);
router.post(
  "/retentativaCobranca",
  AuthGuard,
  pixController.solicitarRetentativaCobranca,
);
router.post(
  "/buscarSolicitacaoRecorrencia",
  AuthGuard,
  pixController.buscarSolicitacaoRecorrencia,
);
router.post(
  "/cancelarSolicitacaoRecorrencia",
  AuthGuard,
  pixController.cancelarSolicitacaoRecorrencia,
);

router.post("/criarWebhookPix", AuthGuard, pixController.AlterarWebhook);
router.post(
  "/criarWebhookPixAutomatico",
  AuthGuard,
  pixController.AlterarWebhookPixAutomatico,
);
router.post(
  "/criarWebhookPixAutomaticoRecurrency",
  AuthGuard,
  pixController.AlterarWebhookPixAutomaticoRecorrencia,
);
router.post(
  "/consultarWebhooksPixAutomatico",
  AuthGuard,
  pixController.consultarWebhooksPixAutomatico,
);
router.post(
  "/conciliarPixAutomatico",
  AuthGuard,
  pixController.conciliarPixAutomatico,
);
router.post(
  "/gerarCobrancasDoMes",
  AuthGuard,
  pixController.gerarCobrancasDoMes,
);

router.post(
  "/getPixAutomaticoClients",
  AuthGuard,
  pixController.listaPixAutomatico,
);
router.post(
  "/getPixAutomaticoOneClient",
  AuthGuard,
  pixController.listarPixAutomaticoUmCliente,
);

router.post(
  "/atualizarPixAutomaticoClients",
  AuthGuard,
  pixController.atualizarPixAutomatico,
);

router.post(
  "/simularPagamento",
  AuthGuard,
  pixController.simularPagamentoWebhookPixAutomatico,
);

router.get(
  "/notificacoesPagamentos",
  AuthGuard,
  pixController.notificacoesPagamentos,
);
router.post("/BuscarPixPago", AuthGuard, pixController.BuscarPixPago);
router.post("/BuscarPixPagoData", AuthGuard, pixController.BuscarPixPagoData);
router.post(
  "/ReenviarNotificacoes",
  AuthGuard,
  pixController.ReenviarNotificacoes,
);

// Exemplo: /api/Pix/PixTodosVencidos/webhook
// Exemplo: /api/Pix/PixAutomatico/webhookCobr
// Exemplo: /api/Pix/PixAutomatico/webhookRec

// router.post('/PixUnicoVencido/webhook', pixController.StatusUpdatePixUnicoVencido);
router.post(
  "/PixTodosVencidos/webhook",
  pixController.StatusUpdatePixTodosVencidos,
);
router.post(
  "/PixAutomatico/webhookCobr",
  pixController.PixAutomaticWebhookCobr,
);
router.post("/PixAutomatico/webhookRec", pixController.PixAutomaticWebhookRec);

export default router;
