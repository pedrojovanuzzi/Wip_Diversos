import { Router } from "express";
import ZapSign from "../controller/ZapSign";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

//Routes
router.post(
  "/generatePdf/contratacao",
  AuthGuard,
  ZapSign.generatePdfContratacao,
);

export default router;
