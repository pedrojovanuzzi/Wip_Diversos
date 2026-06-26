import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import FileShareController, { FILESHARE_DIR } from "../controller/FileShare";

// Garante que a pasta de armazenamento exista
fs.mkdirSync(FILESHARE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, FILESHARE_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  },
});

// Limite de 1 GB por arquivo
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });

const controller = new FileShareController();

const router: Router = Router();

router.post("/upload", upload.single("file"), controller.upload);
router.get("/list", controller.list);
router.get("/d/:token", controller.download);
router.delete("/:id", controller.remove);

export default router;
