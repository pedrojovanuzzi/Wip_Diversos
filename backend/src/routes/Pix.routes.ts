import { Router } from "express";
import Pix from "../controller/Pix";
import AuthGuard from "../middleware/AuthGuard";
import { protegido } from "../middleware/PermissionGuard";
import { semAuditoria } from "../utils/auditoria";

const pixController = new Pix();

const router: Router = Router();

// Níveis iguais aos das telas no frontend (App.tsx): operador = 2, admin = 5.
const operador = protegido(2);
const admin = protegido(5);

//Codigo Legado que foi adaptado para typescript
router.post("/gerador", operador, pixController.gerarPix);
router.get("/gerador", operador, pixController.gerarPix);

router.post("/geradorAll", operador, pixController.gerarPixAll);
router.get("/geradorAll", operador, pixController.gerarPixAll);

router.post("/geradorAberto", operador, pixController.gerarPixAberto);
router.get("/geradorAberto", operador, pixController.gerarPixAberto);

router.post("/geradorTitulos", operador, pixController.gerarPixVariasContas);
router.get("/geradorTitulos", operador, pixController.gerarPixVariasContas);

router.post("/criarPixAutomatico", operador, pixController.PixAutomaticoCriar);
router.post(
  "/criarCobrancaPixAutomatico",
  admin,
  pixController.pegarUltimoBoletoGerarPixAutomaticoSimular,
);
router.post("/cancelarCobranca", admin, pixController.cancelarCobranca);
router.post("/buscarCobranca", operador, semAuditoria, pixController.buscarCobranca);
router.post(
  "/listarCobrancasPixAutomatico",
  operador,
  pixController.listarCobrancasPixAutomatico,
);
router.post(
  "/retentativaCobranca",
  operador,
  pixController.solicitarRetentativaCobranca,
);
router.post(
  "/buscarSolicitacaoRecorrencia",
  operador,
  pixController.buscarSolicitacaoRecorrencia,
);
router.post(
  "/cancelarSolicitacaoRecorrencia",
  operador,
  pixController.cancelarSolicitacaoRecorrencia,
);

router.post("/criarWebhookPix", admin, pixController.AlterarWebhook);
router.post(
  "/criarWebhookPixAutomatico",
  admin,
  pixController.AlterarWebhookPixAutomatico,
);
router.post(
  "/criarWebhookPixAutomaticoRecurrency",
  admin,
  pixController.AlterarWebhookPixAutomaticoRecorrencia,
);
router.post(
  "/consultarWebhooksPixAutomatico",
  admin,
  pixController.consultarWebhooksPixAutomatico,
);
router.post(
  "/conciliarPixAutomatico",
  operador,
  pixController.conciliarPixAutomatico,
);
router.post(
  "/gerarCobrancasDoMes",
  admin,
  pixController.gerarCobrancasDoMes,
);

router.post(
  "/getPixAutomaticoClients",
  operador,
  pixController.listaPixAutomatico,
);
router.post(
  "/getPixAutomaticoOneClient",
  operador,
  pixController.listarPixAutomaticoUmCliente,
);

router.post(
  "/atualizarPixAutomaticoClients",
  operador,
  pixController.atualizarPixAutomatico,
);

router.post(
  "/simularPagamento",
  admin,
  pixController.simularPagamentoWebhookPixAutomatico,
);

router.get(
  "/dadosClientePixAutomatico",
  operador,
  pixController.dadosClientePixAutomatico,
);
router.get(
  "/notificacoesPagamentos",
  AuthGuard,
  pixController.notificacoesPagamentos,
);
router.post("/BuscarPixPago", operador, semAuditoria, pixController.BuscarPixPago);
router.post("/BuscarPixPagoData", operador, semAuditoria, pixController.BuscarPixPagoData);
router.post(
  "/ReenviarNotificacoes",
  admin,
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
