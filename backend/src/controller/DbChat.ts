import { Request, Response } from "express";
import { dbChatAsk } from "../services/DbChatService";

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
}

export default new DbChat();
