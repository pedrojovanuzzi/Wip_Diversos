import { Router } from "express";
import Feedback from "../controller/Feedback";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router()

//Routes
router.get("/NoteInternet/month", Feedback.getNoteInternet_Month);
router.get("/NoteInternet/year", Feedback.getNoteInternet_Year);

router.get("/NoteService/month", Feedback.getNoteService_Month);
router.get("/NoteService/year", Feedback.getNoteService_Year);

router.get("/NoteResponseTime/month", Feedback.getNoteResponseTime_Month);
router.get("/NoteResponseTime/year", Feedback.getNoteResponseTime_Year);

router.post("/NoteTechnician/month", Feedback.getTechnician_Month);
router.post("/NoteTechnician/year", Feedback.getTechnician_Year);

router.get("/NoteDoYouRecommend/month", Feedback.doYouRecommend_Month);
router.get("/NoteDoYouRecommend/year", Feedback.doYouRecommend_Year);

router.get("/NoteDoYouProblemAsSolved/month", Feedback.doYouProblemAsSolved_Month);
router.get("/NoteDoYouProblemAsSolved/year", Feedback.doYouProblemAsSolved_Year);

router.post("/create", AuthGuard, Feedback.createFeedbackLink);
router.post("/:id", Feedback.submitFeedback);
router.get("/:id", Feedback.getFeedbackUUID);





export default router;