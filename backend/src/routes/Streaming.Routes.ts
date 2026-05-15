import { Router } from "express";
import Streaming from "../controller/Streaming";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

router.get("/", AuthGuard, Streaming.list);
router.get("/login/:login", AuthGuard, Streaming.getByLogin);
router.put("/:id/phone", AuthGuard, Streaming.updatePhone);
router.put("/:id/status", AuthGuard, Streaming.toggleStatus);
router.delete("/:id", AuthGuard, Streaming.remove);

export default router;
