import { Router } from "express";
import EmployeeController from "../controller/EmployeeController";
import TimeRecordController from "../controller/TimeRecordController";
import DailyOvertimeController from "../controller/DailyOvertimeController";
import ImageController from "../controller/ImageController";
import MonthlyReportSignatureController from "../controller/MonthlyReportSignatureController";
import AuthGuard, { AuthOpcional } from "../middleware/AuthGuard";
import { protegido } from "../middleware/PermissionGuard";

const TimeTrackingRoutes = Router();

// Protected Image Route
TimeTrackingRoutes.get(
  "/image/:filename",
  AuthGuard,
  ImageController.serveImage,
);

// A tela de bater ponto (/TimeTracking/ClockIn) e a de feedback são públicas:
// elas só precisam de id/nome dos funcionários e dos tipos já batidos no dia.
// Por isso essas leituras usam AuthOpcional e o controller só devolve CPF,
// local e foto para administrador. O resto exige login de administrador,
// igual às telas Admin/Map/Report no frontend.
const somenteAdmin = protegido(5);

// Employee Routes
TimeTrackingRoutes.post("/employee", somenteAdmin, EmployeeController.create);
TimeTrackingRoutes.get("/employee", AuthOpcional, EmployeeController.list);
TimeTrackingRoutes.put("/employee/:id", somenteAdmin, EmployeeController.update);
TimeTrackingRoutes.delete(
  "/employee/:id",
  somenteAdmin,
  EmployeeController.delete,
);

// Time Record Routes
// Público: quem bate o ponto se identifica pelo CPF (validado no controller).
TimeTrackingRoutes.post("/clock-in", TimeRecordController.clockIn);
TimeTrackingRoutes.get(
  "/records/:employeeId",
  somenteAdmin,
  TimeRecordController.listByEmployee,
);
TimeTrackingRoutes.get("/map-records", somenteAdmin, TimeRecordController.listAll);
TimeTrackingRoutes.get(
  "/records/date/:employeeId",
  AuthOpcional,
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
// /overtime e /signature validam o CPF do funcionário no controller.
TimeTrackingRoutes.post("/overtime", DailyOvertimeController.save);
TimeTrackingRoutes.post("/signature", DailyOvertimeController.saveSignature);
TimeTrackingRoutes.post(
  "/day-status",
  somenteAdmin,
  DailyOvertimeController.saveDayStatus,
);

// Ajuste manual das horas extras pelo relatório: só administradores.
TimeTrackingRoutes.put(
  "/overtime/manual",
  somenteAdmin,
  TimeRecordController.setManualOvertime,
);
TimeTrackingRoutes.delete(
  "/overtime/manual",
  somenteAdmin,
  TimeRecordController.clearManualOvertime,
);

TimeTrackingRoutes.get(
  "/overtime/:employeeId/:month/:year",
  somenteAdmin,
  DailyOvertimeController.getByMonth,
);

// Monthly Signature Routes
TimeTrackingRoutes.post(
  "/monthly-signature",
  somenteAdmin,
  MonthlyReportSignatureController.save,
);
TimeTrackingRoutes.get(
  "/monthly-signature/:employeeId/:month/:year",
  somenteAdmin,
  MonthlyReportSignatureController.get,
);

export default TimeTrackingRoutes;
