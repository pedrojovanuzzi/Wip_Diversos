import {Router} from "express"
import AuthGuard from "../middleware/AuthGuard";
import ServerLogs from "../controller/ServerLogs";

const serverLogs = new ServerLogs();

// import 
const router: Router = Router();

router.get("/", AuthGuard, serverLogs.getFolders);
router.post("/FoldersRecursion/", AuthGuard, serverLogs.FoldersRecursion);

export default router;