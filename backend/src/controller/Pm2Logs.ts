import { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

type LogEntry = {
  name: string;
  pm_id: number;
  type: "out" | "err";
  line: string;
};

async function readLastLines(filePath: string, maxLines: number): Promise<string[]> {
  try {
    const stat = await fs.promises.stat(filePath);
    const maxBytes = 512 * 1024;
    const start = Math.max(0, stat.size - maxBytes);
    const fd = await fs.promises.open(filePath, "r");
    try {
      const length = stat.size - start;
      const buffer = Buffer.alloc(length);
      await fd.read(buffer, 0, length, start);
      const text = buffer.toString("utf-8");
      const lines = text.split(/\r?\n/);
      if (start > 0 && lines.length > 0) lines.shift();
      return lines.slice(-maxLines);
    } finally {
      await fd.close();
    }
  } catch {
    return [];
  }
}

class Pm2Logs {
  public async getLogs(req: Request, res: Response) {
    try {
      const lines = Math.min(Number(req.query.lines) || 500, 5000);
      const { stdout } = await execAsync("pm2 jlist", { maxBuffer: 50 * 1024 * 1024 });
      const procs = JSON.parse(stdout || "[]");
      const result: LogEntry[] = [];

      for (const p of procs) {
        const env = p.pm2_env || {};
        const name: string = p.name || "unknown";
        const pm_id: number = p.pm_id ?? -1;
        const outPath: string | undefined = env.pm_out_log_path;
        const errPath: string | undefined = env.pm_err_log_path;

        if (outPath) {
          const outLines = await readLastLines(outPath, lines);
          for (const line of outLines) {
            if (line.trim().length === 0) continue;
            result.push({ name, pm_id, type: "out", line });
          }
        }
        if (errPath) {
          const errLines = await readLastLines(errPath, lines);
          for (const line of errLines) {
            if (line.trim().length === 0) continue;
            result.push({ name, pm_id, type: "err", line });
          }
        }
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error("Pm2Logs.getLogs", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  }

  public async listProcesses(req: Request, res: Response) {
    try {
      const { stdout } = await execAsync("pm2 jlist", { maxBuffer: 50 * 1024 * 1024 });
      const procs = JSON.parse(stdout || "[]");
      const slim = procs.map((p: any) => ({
        pm_id: p.pm_id,
        name: p.name,
        status: p.pm2_env?.status,
        restarts: p.pm2_env?.restart_time,
        uptime: p.pm2_env?.pm_uptime,
        cpu: p.monit?.cpu,
        memory: p.monit?.memory,
      }));
      res.status(200).json(slim);
    } catch (error: any) {
      console.error("Pm2Logs.listProcesses", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  }
}

export default Pm2Logs;
