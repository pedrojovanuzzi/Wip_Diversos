import { Router } from "express";
import Feedback from "../controller/Feedback";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()

//Routes
router.post("/create", AuthGuard, Feedback.createFeedbackLink);
router.post("/:id", Feedback.submitFeedback);
router.get("/:id", Feedback.getFeedbackUUID);




export default router;