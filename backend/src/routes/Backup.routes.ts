import { Router } from "express";
import Backup from "../controller/Backup";
import AuthGuard from "../middleware/AuthGuard";

const backup = new Backup();

const router: Router = Router()

//Routes
router.get("/Backup", AuthGuard, backup.gerarTodosButton);


export default router;