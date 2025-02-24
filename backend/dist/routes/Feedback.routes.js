"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Feedback_1 = __importDefault(require("../controller/Feedback"));
const AuthGuard_1 = __importDefault(require("../middleware/AuthGuard"));
const router = (0, express_1.Router)();
//Routes
router.get("/NoteInternet/month", AuthGuard_1.default, Feedback_1.default.getNoteInternet_Month);
router.get("/NoteInternet/year", AuthGuard_1.default, Feedback_1.default.getNoteInternet_Year);
router.get("/NoteService/month", AuthGuard_1.default, Feedback_1.default.getNoteService_Month);
router.get("/NoteService/year", AuthGuard_1.default, Feedback_1.default.getNoteService_Year);
router.get("/NoteResponseTime/month", AuthGuard_1.default, Feedback_1.default.getNoteResponseTime_Month);
router.get("/NoteResponseTime/year", AuthGuard_1.default, Feedback_1.default.getNoteResponseTime_Year);
router.post("/NoteTechnician/month", AuthGuard_1.default, Feedback_1.default.getTechnician_Month);
router.post("/NoteTechnician/year", AuthGuard_1.default, Feedback_1.default.getTechnician_Year);
router.get("/NoteDoYouRecommend/month", AuthGuard_1.default, Feedback_1.default.doYouRecommend_Month);
router.get("/NoteDoYouRecommend/year", AuthGuard_1.default, Feedback_1.default.doYouRecommend_Year);
router.get("/NoteDoYouProblemAsSolved/month", AuthGuard_1.default, Feedback_1.default.doYouProblemAsSolved_Month);
router.get("/NoteDoYouProblemAsSolved/year", AuthGuard_1.default, Feedback_1.default.doYouProblemAsSolved_Year);
router.get("/NoteFeedbackOpnion", AuthGuard_1.default, Feedback_1.default.feedbackOpnion);
router.post("/create", AuthGuard_1.default, Feedback_1.default.createFeedbackLink);
router.post("/:id", Feedback_1.default.submitFeedback);
router.get("/:id", Feedback_1.default.getFeedbackUUID);
exports.default = router;
