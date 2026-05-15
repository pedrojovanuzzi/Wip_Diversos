import { Router } from "express";
import SerContratos from "../controller/SerContratos";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

router.get("/:login", AuthGuard, SerContratos.listByLogin);
router.post("/", AuthGuard, SerContratos.add);
router.delete("/:id", AuthGuard, SerContratos.remove);
router.post("/remove-by-type", AuthGuard, SerContratos.removeAllOfTypeForLogin);

export default router;
