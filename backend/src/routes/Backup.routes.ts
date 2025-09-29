import { Router } from "express";
import Backup from "../controller/Backup";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()

//Routes
router.get("/Backup", AuthGuard, Backup.gerarTodosButton);


export default router;