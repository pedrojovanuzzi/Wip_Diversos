import { Router } from "express";
import Chamados from "../controller/Chamados";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

//Routes
router.get("/", AuthGuard, Chamados.showMonth);
router.get("/year", AuthGuard, Chamados.showYear);
router.get("/all", AuthGuard, Chamados.showAll);
router.get("/returns/month", AuthGuard, Chamados.returnMonth);
router.get("/returns/year", AuthGuard, Chamados.returnYear);
router.get("/analytics/instalacoes", AuthGuard, Chamados.getInstallationStats);
router.get(
  "/analytics/instalacoes/trend",
  AuthGuard,
  Chamados.getInstallationMonthlyTrend,
);
router.get(
  "/analytics/instalacoes/anos",
  AuthGuard,
  Chamados.getInstallationYearlyComparison,
);
router.get("/analytics/agents", AuthGuard, Chamados.getAgentStats);
router.get(
  "/analytics/clientes/ativados",
  AuthGuard,
  Chamados.getClientesAtivadosComparison,
);
router.get(
  "/analytics/instalacoes/diagnostico",
  AuthGuard,
  Chamados.getInstallationAssuntosBreakdown,
);
router.get(
  "/analytics/instalacoes/historico-mensal",
  AuthGuard,
  Chamados.getInstallationMonthlyHistory,
);
router.get(
  "/analytics/clientes/mensal",
  AuthGuard,
  Chamados.getClientesAtivadosMensal,
);
router.get(
  "/analytics/cancelamentos/motivos",
  AuthGuard,
  Chamados.analyzeCancellationReasons,
);
router.post(
  "/analytics/cancelamentos/motivos/start",
  AuthGuard,
  Chamados.startCancellationAnalysis,
);
router.get(
  "/analytics/cancelamentos/motivos/status",
  AuthGuard,
  Chamados.getCancellationAnalysisStatus,
);
router.post(
  "/analytics/cancelamentos/motivos/cancel",
  AuthGuard,
  Chamados.cancelCancellationAnalysis,
);
router.post(
  "/analytics/cancelamentos/motivos/ask",
  AuthGuard,
  Chamados.askCancellationAnalysis,
);
router.post(
  "/analytics/churn-risk/start",
  AuthGuard,
  Chamados.startChurnRiskAnalysis,
);
router.get(
  "/analytics/churn-risk/status",
  AuthGuard,
  Chamados.getChurnRiskStatus,
);
router.post(
  "/analytics/churn-risk/cancel",
  AuthGuard,
  Chamados.cancelChurnRiskAnalysis,
);
router.get(
  "/analytics/churn-risk/client/:login",
  AuthGuard,
  Chamados.getChurnRiskForClient,
);
router.get("/analytics/ai/status", AuthGuard, Chamados.ollamaStatus);

export default router;
