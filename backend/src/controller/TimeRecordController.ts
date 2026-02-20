import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import { TimeRecord } from "../entities/TimeRecord";
import { Employee } from "../entities/Employee";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Between } from "typeorm";
import Holidays from "date-holidays";

class TimeRecordController {
  private timeRepo = AppDataSource.getRepository(TimeRecord);
  private employeeRepo = AppDataSource.getRepository(Employee);

  isHoliday(date: Date): boolean {
    // Check Sunday (0)
    if (date.getDay() === 0) return true;

    // Use date-holidays for BR/SP/Arealva
    const hd = new Holidays("BR", "SP", "Arealva");
    const holiday = hd.isHoliday(date);

    if (holiday) {
      console.log(
        `Feriado detectado: ${holiday[0].name} em ${date.toISOString()}`,
      );
      return true;
    }

    return false;
  }

  clockIn = async (req: Request, res: Response) => {
    try {
      const { employeeId, lat, lng, photo, type, timestamp, cpf, scale } =
        req.body;
      const employee = await this.employeeRepo.findOneBy({
        id: Number(employeeId),
      });

      if (!employee) {
        res.status(404).json({ error: "Employee not found" });
        return;
      }

      // CPF Verification
      const cleanCpfInput = cpf ? cpf.replace(/\D/g, "") : "";
      const cleanCpfStored = employee.cpf
        ? employee.cpf.replace(/\D/g, "")
        : "";

      if (!cleanCpfInput || cleanCpfInput !== cleanCpfStored) {
        res.status(401).json({ error: "CPF incorreto. Tente novamente." });
        return;
      }

      let photoPath = "";
      if (photo) {
        const match = photo.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (match) {
          const buffer = Buffer.from(match[2], "base64");
          const fileName = `${uuidv4()}.png`;
          const uploadDir = path.join(process.cwd(), "uploads", "time_records");

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          photoPath = path
            .join("uploads", "time_records", fileName)
            .replace(/\\/g, "/");
          fs.writeFileSync(path.join(uploadDir, fileName), buffer);
        }
      }

      const recordTime = timestamp ? new Date(timestamp) : new Date();

      const record = this.timeRepo.create({
        employee,
        timestamp: recordTime,
        location: `${lat},${lng}`,
        photo_url: photoPath,
        type: type || "entry",
      });

      await this.timeRepo.save(record);

      // Overtime Calculation on "Saída"
      if (type === "Saída") {
        await this.calculateAndsaveOvertime(
          Number(employeeId),
          recordTime,
          scale,
        );
      }

      res.status(201).json(record);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error clocking in" });
    }
  };

  calculateAndsaveOvertime = async (
    employeeId: number,
    date: Date,
    scale: "8h" | "12h" | "Integral" | "4h" = "8h",
  ) => {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const records = await this.timeRepo.find({
        where: {
          employeeId,
          timestamp: Between(startOfDay, endOfDay),
        },
        order: { timestamp: "ASC" },
      });

      let workedMinutes = 0;

      if (scale === "12h") {
        // For 12h scale, lunch time counts as worked time.
        // So we calculate the total duration from the first 'Entrada' to the last 'Saída'.
        const firstEntry = records.find(
          (r) => r.type === "Entrada" || r.type === "Volta Almoço",
        ); // Generally first entry
        // Actually, strictly 'Entrada' should be start.
        // But let's take the very first record timestamp if it exists.
        if (records.length > 0) {
          const startTime = records[0].timestamp.getTime();
          const endTime = records[records.length - 1].timestamp.getTime();
          workedMinutes = (endTime - startTime) / 60000;
        }
      } else {
        // For 8h scale (or others), lunch time is UNPAID/Not Worked.
        // We sum actual worked intervals.
        let lastEntry: Date | null = null;

        for (const rec of records) {
          if (rec.type === "Entrada" || rec.type === "Volta Almoço") {
            lastEntry = rec.timestamp;
          } else if (
            (rec.type === "Saída Almoço" || rec.type === "Saída") &&
            lastEntry
          ) {
            const diffMs = rec.timestamp.getTime() - lastEntry.getTime();
            workedMinutes += diffMs / 60000;
            lastEntry = null; // Reset for next pair
          }
        }
      }

      const thresholdMinutes =
        scale === "12h"
          ? 720
          : scale === "Integral"
            ? 0
            : scale === "4h"
              ? 240
              : 480; // 12*60 or 0 or 4*60 or 8*60
      const TOLERANCE = 10;

      // Se passar da tolerância (ex: 8h10m), paga TUDO (os 10m + excedente).
      // Se não passar (ex: 8h10m cravados), paga ZERO.
      if (workedMinutes > thresholdMinutes + TOLERANCE) {
        // +10 min tolerance checked
        const extraMinutes = workedMinutes - thresholdMinutes; // Count from threshold (e.g. 0)

        // User wants HH.MM format (e.g. 1h 15m -> 1.15, NOT 1.25)
        const hours = Math.floor(extraMinutes / 60);
        const mins = Math.round(extraMinutes % 60); // Round to nearest minute to avoid .149999
        const extraHoursFormatted = hours + mins / 100;

        const isSundayOrHoliday = this.isHoliday(date);

        const dailyOvertimeRepo = AppDataSource.getRepository("DailyOvertime"); // Use string if entity not imported directly/circular
        // But we can import DailyOvertime. Importing at top.

        // Check if exists update
        // Fix for date shift: avoid toISOString() which uses UTC. Use local date.
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        let overtimeEntry = await AppDataSource.getRepository(
          "DailyOvertime",
        ).findOne({
          where: { employeeId, date: dateStr },
        });

        if (!overtimeEntry) {
          overtimeEntry = AppDataSource.getRepository("DailyOvertime").create({
            employeeId,
            date: dateStr,
          });
        }

        if (isSundayOrHoliday) {
          overtimeEntry.hours100 = extraHoursFormatted;
          overtimeEntry.hours50 = 0;
        } else {
          overtimeEntry.hours50 = extraHoursFormatted;
          overtimeEntry.hours100 = 0;
        }

        await AppDataSource.getRepository("DailyOvertime").save(overtimeEntry);
        console.log(
          `Overtime saved for ${employeeId}: ${extraHoursFormatted.toFixed(
            2,
          )} (HH.MM) (${scale})`,
        );
      }
    } catch (err) {
      console.error("Error calculating overtime:", err);
    }
  };

  listByEmployee = async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const records = await this.timeRepo.find({
        where: { employeeId: Number(employeeId) },
        order: { timestamp: "DESC" },
      });
      res.json(records);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching records" });
    }
  };

  listAll = async (req: Request, res: Response) => {
    try {
      // Optional: limit to last 30 days or similar if needed
      const records = await this.timeRepo.find({
        relations: ["employee"],
        order: { timestamp: "DESC" },
        take: 500, // Limit to prevent overload
      });
      res.json(records);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching all records" });
    }
  };
  getByDate = async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const { date } = req.query;

      if (!date) {
        res.status(400).json({ error: "Date parameter is required" });
        return;
      }

      const dateStr = String(date); // YYYY-MM-DD
      const startOfDay = new Date(`${dateStr}T00:00:00`);
      const endOfDay = new Date(`${dateStr}T23:59:59`);

      const records = await this.timeRepo.find({
        where: {
          employeeId: Number(employeeId),
          timestamp: Between(startOfDay, endOfDay),
        },
        order: { timestamp: "ASC" },
      });

      res.json(records);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching daily records" });
    }
  };
}

export default new TimeRecordController();
