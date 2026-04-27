import { Router } from "express";
import AuthGuard from "../middleware/AuthGuard";
import Pm2Logs from "../controller/Pm2Logs";

const pm2Logs = new Pm2Logs();
const router: Router = Router();

router.get("/", AuthGuard, pm2Logs.getLogs);
router.get("/processes", AuthGuard, pm2Logs.listProcesses);

export default router;
