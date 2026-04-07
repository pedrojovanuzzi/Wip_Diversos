import { Router } from "express";
import SolicitacaoServicoController from "../controller/SolicitacaoServico";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

router.get("/", AuthGuard, (req, res) => SolicitacaoServicoController.list(req, res));
router.post("/consultar-cpf/:id", AuthGuard, (req, res) => SolicitacaoServicoController.consultarCpf(req, res));
router.post("/consultar-cpf-manual/:id", AuthGuard, (req, res) => SolicitacaoServicoController.consultarCpfManual(req, res));
router.post("/ignorar-consulta/:id", AuthGuard, (req, res) => SolicitacaoServicoController.ignorarConsulta(req, res));
router.post("/finalizar/:id", AuthGuard, (req, res) => SolicitacaoServicoController.finalizar(req, res));

export default router;
