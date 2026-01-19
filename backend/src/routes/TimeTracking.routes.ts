import { Router } from "express";
import EmployeeController from "../controller/EmployeeController";
import TimeRecordController from "../controller/TimeRecordController";
import DailyOvertimeController from "../controller/DailyOvertimeController";
import ImageController from "../controller/ImageController";
import AuthGuard from "../middleware/AuthGuard";

const TimeTrackingRoutes = Router();

// Protected Image Route
TimeTrackingRoutes.get(
  "/image/:filename",
  AuthGuard,
  ImageController.serveImage,
);

// Employee Routes
TimeTrackingRoutes.post("/employee", EmployeeController.create);
TimeTrackingRoutes.get("/employee", EmployeeController.list);
TimeTrackingRoutes.put("/employee/:id", EmployeeController.update);
TimeTrackingRoutes.delete("/employee/:id", EmployeeController.delete);

// Time Record Routes
TimeTrackingRoutes.post("/clock-in", TimeRecordController.clockIn);
TimeTrackingRoutes.get(
  "/records/:employeeId",
  TimeRecordController.listByEmployee,
);
TimeTrackingRoutes.get("/map-records", TimeRecordController.listAll);

// Overtime Routes
TimeTrackingRoutes.post("/overtime", DailyOvertimeController.save);
TimeTrackingRoutes.post("/signature", DailyOvertimeController.saveSignature);

TimeTrackingRoutes.get(
  "/overtime/:employeeId/:month/:year",
  DailyOvertimeController.getByMonth,
);

export default TimeTrackingRoutes;
