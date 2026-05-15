import { Request, Response } from "express";
import { dbChatAsk } from "../services/DbChatService";

interface DbChatJob {
  stage: "generating_sql" | "executing" | "summarizing" | "done" | "error";
  startedAt: number;
  result?: any;
  error?: string;
}

const dbChatJobs: Map<string, DbChatJob> = new Map();

class DbChat {
  public async ask(req: Request, res: Response) {
    try {
      const { question, history } = req.body as {
        question?: string;
        history?: { role: "user" | "assistant"; content: string }[];
      };
      if (!question?.trim()) {
        res.status(400).json({ message: "question é obrigatório." });
        return;
      }
      const result = await dbChatAsk(question.trim(), history || []);
      res.json(result);
    } catch (error: any) {
      console.error("Erro no DB chat:", error);
      res.status(500).json({
        message: "Erro ao consultar o banco.",
        error: error?.message || String(error),
      });
    }
  }

  public async start(req: Request, res: Response) {
    try {
      const { question, history } = req.body as {
        question?: string;
        history?: { role: "user" | "assistant"; content: string }[];
      };
      if (!question?.trim()) {
        res.status(400).json({ message: "question é obrigatório." });
        return;
      }
      const jobId = `dbchat-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const job: DbChatJob = {
        stage: "generating_sql",
        startedAt: Date.now(),
      };
      dbChatJobs.set(jobId, job);

      (async () => {
        try {
          const result = await dbChatAsk(
            question.trim(),
            history || [],
            (stage) => {
              if (
                stage === "generating_sql" ||
                stage === "executing" ||
                stage === "summarizing"
              ) {
                job.stage = stage;
              }
            },
          );
          job.result = result;
          job.stage = "done";
        } catch (e: any) {
          job.stage = "error";
          job.error = e?.message || String(e);
          console.error("DbChat job error:", e);
        }
      })();

      res.status(202).json({ jobId });
    } catch (error: any) {
      console.error("Erro no DB chat start:", error);
      res.status(500).json({ message: "Erro ao iniciar consulta." });
    }
  }

  public async status(req: Request, res: Response) {
    const jobId = String(req.query.jobId || "");
    const job = dbChatJobs.get(jobId);
    if (!job) {
      res.status(404).json({ message: "Job não encontrado." });
      return;
    }
    res.json({
      jobId,
      stage: job.stage,
      elapsedMs: Date.now() - job.startedAt,
      ...(job.stage === "done" ? { result: job.result } : {}),
      ...(job.stage === "error" ? { error: job.error } : {}),
    });
    if (job.stage === "done" || job.stage === "error") {
      setTimeout(() => dbChatJobs.delete(jobId), 10 * 60 * 1000);
    }
  }
}

export default new DbChat();
