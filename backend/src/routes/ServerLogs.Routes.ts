import {Router} from "express"
import AuthGuard from "../middleware/AuthGuard";
import ServerLogs from "../controller/ServerLogs";

const serverLogs = new ServerLogs();

// import 
const router: Router = Router();

router.get("/", AuthGuard, serverLogs.getFolders);
router.post("/FoldersRecursion", AuthGuard, serverLogs.FoldersRecursion);
router.post("/AccessFile", AuthGuard, serverLogs.AccessFile);
router.post("/SearchClientLogs/start", AuthGuard, serverLogs.SearchClientLogsStart);
router.get("/SearchClientLogs/progress/:jobId", AuthGuard, serverLogs.SearchClientLogsProgress);
router.get("/SearchClientLogs/download/:jobId", AuthGuard, serverLogs.SearchClientLogsDownload);

export default router;