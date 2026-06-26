import { Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import LocalDataSource from "../database/DataSource";
import { FileShare } from "../entities/FileShare";

// Pasta onde os arquivos enviados ficam armazenados
export const FILESHARE_DIR = path.join(__dirname, "../../uploads/fileshare");

class FileShareController {
  private repo = LocalDataSource.getRepository(FileShare);

  // POST /api/files/upload  (multipart, campo "file")
  upload = async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ erro: "Nenhum arquivo enviado." });
        return;
      }

      const token = crypto.randomBytes(16).toString("hex");

      const registro = await this.repo.save({
        token,
        originalName: Buffer.from(file.originalname, "latin1").toString("utf8"),
        storedName: file.filename,
        mimeType: file.mimetype || null,
        size: file.size,
        downloads: 0,
      });

      res.status(201).json(registro);
    } catch (error: any) {
      console.error("[FileShare] Erro no upload:", error);
      res.status(500).json({ erro: error?.message || "Erro ao enviar arquivo" });
    }
  };

  // GET /api/files/list
  list = async (_req: Request, res: Response): Promise<void> => {
    try {
      const registros = await this.repo.find({
        order: { created_at: "DESC" },
      });
      res.json(registros);
    } catch (error: any) {
      console.error("[FileShare] Erro ao listar:", error);
      res.status(500).json({ erro: error?.message || "Erro ao listar arquivos" });
    }
  };

  // GET /api/files/d/:token  (download público)
  download = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const registro = await this.repo.findOne({ where: { token } });

      if (!registro) {
        res.status(404).send("Arquivo não encontrado.");
        return;
      }

      const filePath = path.join(FILESHARE_DIR, registro.storedName);
      if (!fs.existsSync(filePath)) {
        res.status(404).send("Arquivo não encontrado no servidor.");
        return;
      }

      await this.repo.increment({ id: registro.id }, "downloads", 1);

      res.download(filePath, registro.originalName, (err) => {
        if (err && !res.headersSent) {
          console.error("[FileShare] Erro no download:", err);
          res.status(500).send("Erro ao baixar o arquivo.");
        }
      });
    } catch (error: any) {
      console.error("[FileShare] Erro no download:", error);
      if (!res.headersSent) {
        res.status(500).send("Erro ao baixar o arquivo.");
      }
    }
  };

  // DELETE /api/files/:id
  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const registro = await this.repo.findOne({ where: { id } });

      if (!registro) {
        res.status(404).json({ erro: "Arquivo não encontrado." });
        return;
      }

      const filePath = path.join(FILESHARE_DIR, registro.storedName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await this.repo.delete({ id });

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[FileShare] Erro ao remover:", error);
      res.status(500).json({ erro: error?.message || "Erro ao remover arquivo" });
    }
  };
}

export default FileShareController;
