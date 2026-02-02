import { Request, Response } from "express";
import DataSource from "../database/DataSource";
import { DailyOvertime } from "../entities/DailyOvertime";
import { Between } from "typeorm";

import { Employee } from "../entities/Employee";

class DailyOvertimeController {
  private employeeRepo = DataSource.getRepository(Employee);

  save = async (req: Request, res: Response) => {
    try {
      const { employeeId, date, hours50, hours100, cpf } = req.body;
      const parsedHours50 = parseFloat(hours50) || 0;
      const parsedHours100 = parseFloat(hours100) || 0;

      // CPF Verification
      const employee = await this.employeeRepo.findOneBy({
        id: Number(employeeId),
      });
      if (!employee) {
        res.status(404).json({ error: "Employee not found" });
        return;
      }
      const cleanCpfInput = cpf ? cpf.replace(/\D/g, "") : "";
      const cleanCpfStored = employee.cpf
        ? employee.cpf.replace(/\D/g, "")
        : "";

      if (!cleanCpfInput || cleanCpfInput !== cleanCpfStored) {
        res.status(401).json({ error: "CPF incorreto. Tente novamente." });
        return;
      }

      const repo = DataSource.getRepository(DailyOvertime);

      let record = await repo.findOne({ where: { employeeId, date } });

      if (record) {
        record.hours50 = parsedHours50;
        record.hours100 = parsedHours100;
        await repo.save(record);
      } else {
        record = repo.create({
          employeeId,
          date,
          hours50: parsedHours50,
          hours100: parsedHours100,
        });
        await repo.save(record);
      }

      res.status(200).json(record);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Error" });
    }
  };

  saveSignature = async (req: Request, res: Response) => {
    try {
      const { employeeId, date, signature, cpf } = req.body;
      const empId = Number(employeeId);

      if (isNaN(empId)) {
        res.status(400).json({ error: "Invalid Employee ID" });
        return;
      }

      // CPF Verification
      const employee = await this.employeeRepo.findOneBy({ id: empId });
      if (!employee) {
        res.status(404).json({ error: "Employee not found" });
        return;
      }
      const cleanCpfInput = cpf ? cpf.replace(/\D/g, "") : "";
      const cleanCpfStored = employee.cpf
        ? employee.cpf.replace(/\D/g, "")
        : "";

      if (!cleanCpfInput || cleanCpfInput !== cleanCpfStored) {
        res.status(401).json({ error: "CPF incorreto. Tente novamente." });
        return;
      }

      const repo = DataSource.getRepository(DailyOvertime);

      let record = await repo.findOne({
        where: { employeeId: empId, date },
      });

      if (record) {
        record.signature = signature;
        await repo.save(record);
      } else {
        record = repo.create({
          employeeId: empId,
          date,
          signature,
        });
        await repo.save(record);
      }

      res.status(200).json(record);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Error" });
    }
  };

  getByMonth = async (req: Request, res: Response) => {
    try {
      const { employeeId, month, year } = req.params;
      const repo = DataSource.getRepository(DailyOvertime);

      const startDate = `${year}-${month}-01`;
      // To get last day of month:
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;

      const records = await repo.find({
        where: {
          employeeId: Number(employeeId),
          date: Between(startDate, endDate) as any, // TypeORM date handling
        },
      });

      res.json(records);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Error" });
    }
  };
}

export default new DailyOvertimeController();
