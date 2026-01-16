import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import { TimeRecord } from "../entities/TimeRecord";
import { Employee } from "../entities/Employee";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

class TimeRecordController {
  private timeRepo = AppDataSource.getRepository(TimeRecord);
  private employeeRepo = AppDataSource.getRepository(Employee);

  clockIn = async (req: Request, res: Response) => {
    try {
      const { employeeId, lat, lng, photo, type } = req.body;
      const employee = await this.employeeRepo.findOneBy({
        id: Number(employeeId),
      });
      if (!employee) {
        res.status(404).json({ error: "Employee not found" });
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
          const uploadDir = path.resolve(
            __dirname,
            "..",
            "..",
            "..",
            "uploads",
            "time_records"
          );

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          photoPath = path.join("uploads", "time_records", fileName);
          fs.writeFileSync(path.resolve(uploadDir, fileName), buffer);
        }
      }

      const record = this.timeRepo.create({
        employee,
        timestamp: new Date(),
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
}

export default new TimeRecordController();
