import { Request, Response } from "express";
import DataSource from "../database/DataSource";
import { DailyOvertime } from "../entities/DailyOvertime";
import { Between } from "typeorm";

class DailyOvertimeController {
  save = async (req: Request, res: Response) => {
    try {
      const { employeeId, date, hours50, hours100 } = req.body;
      const parsedHours50 = parseFloat(hours50) || 0;
      const parsedHours100 = parseFloat(hours100) || 0;

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
