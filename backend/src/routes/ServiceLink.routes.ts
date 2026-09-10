import { Router } from "express";
import ServiceLinkController from "../controller/servicoWeb/ServiceLink";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

// --- Público: acessado pelo cliente através do token do link ---
router.get("/publico/:token", (req, res) =>
  ServiceLinkController.abrir(req, res),
);
router.post("/publico/:token/identificar", (req, res) =>
  ServiceLinkController.identificar(req, res),
);
router.post("/publico/:token/selecionar", (req, res) =>
  ServiceLinkController.selecionar(req, res),
);
router.post("/publico/:token/voltar", (req, res) =>
  ServiceLinkController.voltar(req, res),
);
router.post("/publico/:token/termos", (req, res) =>
  ServiceLinkController.aceitarTermos(req, res),
);
router.post("/publico/:token/pagamento", (req, res) =>
  ServiceLinkController.escolherPagamento(req, res),
);
router.post("/publico/:token/enviar", (req, res) =>
  ServiceLinkController.enviar(req, res),
);
router.get("/publico/:token/status", (req, res) =>
  ServiceLinkController.status(req, res),
);

// --- Interno: geração e acompanhamento dos links ---
router.get("/catalogo", AuthGuard, (req, res) =>
  ServiceLinkController.catalogo(req, res),
);
router.get("/", AuthGuard, (req, res) =>
  ServiceLinkController.listar(req, res),
);
router.post("/", AuthGuard, (req, res) =>
  ServiceLinkController.criar(req, res),
);
router.post("/:id/cancelar", AuthGuard, (req, res) =>
  ServiceLinkController.cancelar(req, res),
);

export default router;
