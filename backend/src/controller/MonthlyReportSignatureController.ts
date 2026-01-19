import { Request, Response } from "express";
import DataSource from "../database/DataSource";
import { MonthlyReportSignature } from "../entities/MonthlyReportSignature";

class MonthlyReportSignatureController {
  save = async (req: Request, res: Response) => {
    try {
      const { employeeId, month, year, signature } = req.body;
      const empId = Number(employeeId);

      if (isNaN(empId)) {
        res.status(400).json({ error: "Invalid Employee ID" });
        return;
      }

      const repo = DataSource.getRepository(MonthlyReportSignature);

      let record = await repo.findOne({
        where: { employeeId: empId, month, year },
      });

      if (record) {
        record.signature = signature;
        await repo.save(record);
      } else {
        record = repo.create({
          employeeId: empId,
          month,
          year,
          signature,
        });
        await repo.save(record);
      }

      res.status(200).json(record);
    } catch (error) {
      console.error("Error saving monthly signature:", error);
      res.status(500).json({ error: "Internal Error" });
    }
  };

  get = async (req: Request, res: Response) => {
    try {
      const { employeeId, month, year } = req.params;
      const empId = Number(employeeId);

      if (isNaN(empId)) {
        res.status(400).json({ error: "Invalid Employee ID" });
        return;
      }

      const repo = DataSource.getRepository(MonthlyReportSignature);

      const record = await repo.findOne({
        where: { employeeId: empId, month, year },
      });

      if (record) {
        res.json(record);
      } else {
        res.json(null); // Or 404, but null is fine for frontend check
      }
    } catch (error) {
      console.error("Error fetching monthly signature:", error);
      res.status(500).json({ error: "Internal Error" });
    }
  };
}

export default new MonthlyReportSignatureController();
