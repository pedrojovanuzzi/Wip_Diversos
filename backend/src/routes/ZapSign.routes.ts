import { Router } from "express";
import ZapSign from "../controller/ZapSign";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

//Routes
router.post("/generatePdf/:pdfName", AuthGuard, ZapSign.generatePdf);

export default router;
