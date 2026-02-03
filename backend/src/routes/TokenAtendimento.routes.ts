import { Router } from "express";
import TokenAtendimento from "../controller/TokenAtendimento";

const router: Router = Router();

const tokenAtendimento = new TokenAtendimento();

//Routes
router.post("/Login", tokenAtendimento.login);
router.post("/ChooseHome", tokenAtendimento.chooseHome);
router.post("/CreateCadastro", tokenAtendimento.criarCadastro);
router.post("/GerarPixToken", tokenAtendimento.gerarPixToken);
router.post("/FaturaWentPaid", tokenAtendimento.faturaWentPaid);
router.post(
  "/ReceberPagamentoMercadoPagoWebhook",
  tokenAtendimento.receberPagamentoMercadoPagoWebhook,
);
router.post(
  "/ObterListaTerminaisEGerarPagamentoCredito",
  tokenAtendimento.obterListaTerminaisEGerarPagamentoCredito,
);
router.post(
  "/ObterListaTerminaisEGerarPagamentoDebito",
  tokenAtendimento.obterListaTerminaisEGerarPagamentoDebito,
);

router.get("/ObterOrderPorId/:order", tokenAtendimento.obterOrderPorId);

export default router;
