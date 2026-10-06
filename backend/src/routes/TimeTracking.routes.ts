import { Router } from "express";
import EmployeeController from "../controller/EmployeeController";
import TimeRecordController from "../controller/TimeRecordController";
import DailyOvertimeController from "../controller/DailyOvertimeController";
import ImageController from "../controller/ImageController";
import MonthlyReportSignatureController from "../controller/MonthlyReportSignatureController";
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
TimeTrackingRoutes.get(
  "/records/date/:employeeId",
  TimeRecordController.getByDate,
);
TimeTrackingRoutes.patch(
  "/records/:id",
  AuthGuard,
  TimeRecordController.updateTimestamp,
);
TimeTrackingRoutes.delete(
  "/records/:id",
  AuthGuard,
  TimeRecordController.deleteRecord,
);

// Overtime Routes
TimeTrackingRoutes.post("/overtime", DailyOvertimeController.save);
TimeTrackingRoutes.post("/signature", DailyOvertimeController.saveSignature);
TimeTrackingRoutes.post("/day-status", DailyOvertimeController.saveDayStatus);

// Ajuste manual das horas extras pelo relatório: só administradores.
const somenteAdmin = (req: any, res: any, next: any) => {
  if ((req.user?.permission ?? 0) < 5) {
    res.status(403).json({ error: "Permissão insuficiente." });
    return;
  }
  next();
};
TimeTrackingRoutes.put(
  "/overtime/manual",
  AuthGuard,
  somenteAdmin,
  TimeRecordController.setManualOvertime,
);
TimeTrackingRoutes.delete(
  "/overtime/manual",
  AuthGuard,
  somenteAdmin,
  TimeRecordController.clearManualOvertime,
);

TimeTrackingRoutes.get(
  "/overtime/:employeeId/:month/:year",
  DailyOvertimeController.getByMonth,
);

// Monthly Signature Routes
TimeTrackingRoutes.post(
  "/monthly-signature",
  MonthlyReportSignatureController.save,
);
TimeTrackingRoutes.get(
  "/monthly-signature/:employeeId/:month/:year",
  MonthlyReportSignatureController.get,
);

export default TimeTrackingRoutes;
