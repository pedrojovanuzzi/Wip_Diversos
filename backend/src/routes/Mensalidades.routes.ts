import { Router } from "express";
import Mensalidades from "../controller/Mensalidades";
import { protegido } from "../middleware/PermissionGuard";

// Clientes e títulos do MK-Auth. Nível igual ao da tela /mensalidades no
// App.tsx (operador = 2); estornar e excluir título são cancelamento de
// cobrança, então nível 5 (.claude/rules/rotas-seguras.md).
const router = Router();
const operador = protegido(2);
const admin = protegido(5);

// Engrenagem: configurações e geração automática de boletos (nível 5).
router.get("/config", admin, Mensalidades.configuracoes);
router.put("/config", admin, Mensalidades.salvarConfiguracoes);
router.post("/config/rodar", admin, Mensalidades.rodarGeracao);

router.get("/clientes", operador, Mensalidades.listarClientes);
router.get("/clientes/:login/faturas", operador, Mensalidades.faturasDoCliente);
router.get(
  "/clientes/:login/novo-titulo",
  operador,
  Mensalidades.sugestaoNovoTitulo,
);
router.post("/clientes/:login/titulos", operador, Mensalidades.novoTitulo);
router.post(
  "/clientes/:login/titulos/excluir",
  admin,
  Mensalidades.excluirTitulos,
);
router.post("/clientes/:login/enviar", operador, Mensalidades.enviar);
// Envio para vários clientes de uma vez: nível 5, como o Disparo em massa.
router.post("/enviar-lote", admin, Mensalidades.enviarLote);

router.get("/titulos/:id/info", operador, Mensalidades.infoTitulo);
router.post("/titulos/:id/receber", operador, Mensalidades.receber);
router.post("/titulos/:id/estornar", admin, Mensalidades.estornar);
router.put("/titulos/:id", operador, Mensalidades.alterar);
router.post("/titulos/:id/atrelar", operador, Mensalidades.atrelar);
router.delete(
  "/titulos/:id/atrelados/:atrelado",
  admin,
  Mensalidades.removerAtrelado,
);
router.post("/titulos/:id/bolix", operador, Mensalidades.bolix);
router.post(
  "/titulos/:id/bolix/verificar",
  operador,
  Mensalidades.verificarBolix,
);

// Pública: é a Efí quem chama (notification_url do bolix). Vem só um token,
// que o controller confere na própria Efí com as nossas credenciais antes de
// dar baixa; um token inventado não acha cobrança e não baixa nada.
router.post("/efi/notificacao", Mensalidades.notificacaoEfi);

router.get("/titulos/:id/notas", operador, Mensalidades.listarNotas);
router.post("/titulos/:id/notas", operador, Mensalidades.adicionarNota);

export default router;
