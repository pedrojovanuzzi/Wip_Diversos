import { Router } from "express";
import Feedback from "../controller/Feedback";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()

//Routes
router.get("/NoteInternet/month", AuthGuard, Feedback.getNoteInternet_Month);
router.get("/NoteInternet/year", AuthGuard, Feedback.getNoteInternet_Year);

router.get("/NoteService/month", AuthGuard, Feedback.getNoteService_Month);
router.get("/NoteService/year", AuthGuard, Feedback.getNoteService_Year);

router.get("/NoteResponseTime/month", AuthGuard, Feedback.getNoteResponseTime_Month);
router.get("/NoteResponseTime/year", AuthGuard, Feedback.getNoteResponseTime_Year);

router.post("/NoteTechnician/month", AuthGuard, Feedback.getTechnician_Month);
router.post("/NoteTechnician/year", AuthGuard, Feedback.getTechnician_Year);

router.get("/NoteDoYouRecommend/month", AuthGuard, Feedback.doYouRecommend_Month);
router.get("/NoteDoYouRecommend/year", AuthGuard, Feedback.doYouRecommend_Year);

router.get("/NoteDoYouProblemAsSolved/month", AuthGuard, Feedback.doYouProblemAsSolved_Month);
router.get("/NoteDoYouProblemAsSolved/year", AuthGuard, Feedback.doYouProblemAsSolved_Year);

router.get("/NoteFeedbackOpnion", AuthGuard, Feedback.feedbackOpnion);

router.post("/create", AuthGuard, Feedback.createFeedbackLink);
router.post("/:id", Feedback.submitFeedback);
router.get("/:id", Feedback.getFeedbackUUID);





export default router;