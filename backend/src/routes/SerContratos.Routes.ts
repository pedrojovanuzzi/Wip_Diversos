import { Router } from "express";
import SerContratos from "../controller/SerContratos";
import AuthGuard from "../middleware/AuthGuard";
import { protegido } from "../middleware/PermissionGuard";

const router: Router = Router();

// Antes de "/:login", senão "clientes" seria tratado como um login.
router.get("/clientes", AuthGuard, SerContratos.listarClientes);
// Idem: rota fixa antes de "/:login".
router.post("/detalhar-nomes", AuthGuard, SerContratos.detalharNomes);
router.get("/:login", AuthGuard, SerContratos.listByLogin);
router.post("/", AuthGuard, SerContratos.add);
router.delete("/:id", AuthGuard, SerContratos.remove);
router.post("/remove-by-type", AuthGuard, SerContratos.removeAllOfTypeForLogin);
router.post("/streaming/convert", AuthGuard, SerContratos.convertStreamingTipo);
router.post("/streaming/link", AuthGuard, SerContratos.gerarLinkStreaming);
// Libera ou tira a Watch TV sem passar pelo contrato: operação, nível 2.
router.post("/watchtv", protegido(2), SerContratos.marcarWatchTv);
// Consulta a conta na Watch Brasil (devolve e-mail e telefone): nível 2.
router.get("/streaming/watch/:login", protegido(2), SerContratos.conferirWatch);

export default router;
