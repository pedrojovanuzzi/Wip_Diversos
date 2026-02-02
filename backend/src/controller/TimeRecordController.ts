import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import { TimeRecord } from "../entities/TimeRecord";
import { Employee } from "../entities/Employee";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Between } from "typeorm";

class TimeRecordController {
  private timeRepo = AppDataSource.getRepository(TimeRecord);
  private employeeRepo = AppDataSource.getRepository(Employee);

  clockIn = async (req: Request, res: Response) => {
    try {
      const { employeeId, lat, lng, photo, type, timestamp, cpf } = req.body;
      const employee = await this.employeeRepo.findOneBy({
        id: Number(employeeId),
      });

      if (!employee) {
        res.status(404).json({ error: "Employee not found" });
        return;
      }

      // CPF Verification
      // Strip non-numeric characters for comparison
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
        // Assume photo is base64: "data:image/png;base64,..."
        const match = photo.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (match) {
          const type = match[1];
          const data = match[2];
          const buffer = Buffer.from(data, "base64");
          const fileName = `${uuidv4()}.png`; // Simple assumption
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

      const record = this.timeRepo.create({
        employee,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        location: `${lat},${lng}`,
        photo_url: photoPath,
        type: type || "entry", // Default or provided
      });

      await this.timeRepo.save(record);
      res.status(201).json(record);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error clocking in" });
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
