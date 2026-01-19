import { Request, Response } from "express";
import path from "path";
import fs from "fs";

class ImageController {
  serveImage = (req: Request, res: Response) => {
    try {
      const { filename } = req.params;

      // Sanitize filename to prevent directory traversal
      const safeFilename = path.basename(filename);

      const filePath = path.join(
        process.cwd(),
        "uploads",
        "time_records",
        safeFilename,
      );

      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: "Image not found" });
      }
    } catch (error) {
      console.error("Error serving image:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
}

export default new ImageController();
