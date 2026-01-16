import { Router } from "express";
import EmployeeController from "../controller/EmployeeController";
import TimeRecordController from "../controller/TimeRecordController";

const TimeTrackingRoutes = Router();

// Employee Routes
TimeTrackingRoutes.post("/employee", EmployeeController.create);
TimeTrackingRoutes.get("/employee", EmployeeController.list);
TimeTrackingRoutes.put("/employee/:id", EmployeeController.update);
TimeTrackingRoutes.delete("/employee/:id", EmployeeController.delete);

// Time Record Routes
TimeTrackingRoutes.post("/clock-in", TimeRecordController.clockIn);
TimeTrackingRoutes.get(
  "/records/:employeeId",
  TimeRecordController.listByEmployee
);

export default TimeTrackingRoutes;
