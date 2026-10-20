import { Request, Response } from "express";
import { Feedback } from "../entities/NotaColaboradores";
import { isUUID } from "class-validator";
import AppDataSource from "../database/DataSource";
import { v4 as uuidv4 } from "uuid";
import { Between } from "typeorm";

class FeedbackController {
  private date: Date;

  constructor() {
    this.date = new Date(); // Inicializa a variável no construtor

    this.createFeedbackLink = this.createFeedbackLink.bind(this);
    this.submitFeedback = this.submitFeedback.bind(this);
    this.getFeedbackUUID = this.getFeedbackUUID.bind(this);
    this.getNoteInternet_Month = this.getNoteInternet_Month.bind(this);
    this.getNoteInternet_Year = this.getNoteInternet_Year.bind(this);
    this.getNoteService_Month = this.getNoteService_Month.bind(this);
    this.getNoteService_Year = this.getNoteService_Year.bind(this);
    this.getNoteResponseTime_Month = this.getNoteResponseTime_Month.bind(this);
    this.getNoteResponseTime_Year = this.getNoteResponseTime_Year.bind(this);
    this.getTechnician_Month = this.getTechnician_Month.bind(this);
    this.getTechnician_Year = this.getTechnician_Year.bind(this);
    this.doYouProblemAsSolved_Month = this.doYouProblemAsSolved_Month.bind(this);
    this.doYouProblemAsSolved_Year = this.doYouProblemAsSolved_Year.bind(this);
    this.doYouRecommend_Month = this.doYouRecommend_Month.bind(this);
    this.doYouRecommend_Year = this.doYouRecommend_Year.bind(this);
    this.feedbackOpnion = this.feedbackOpnion.bind(this);
    this.resumo = this.resumo.bind(this);
  }

  public async createFeedbackLink(req: Request, res: Response) {
    try {
      const { technician } = req.body;

      if (!technician) {
        res.status(400).send("Técnico é obrigatório.");
        return;
      }

      const uniqueIdentifier = uuidv4();

      const feedbackRepository = AppDataSource.getRepository(Feedback);

      const feedback = feedbackRepository.create({
        unique_identifier: uniqueIdentifier,
        login: technician,
      });

      await feedbackRepository.save(feedback);

      res
        .status(201)
        .send({ link: `/feedback/${technician}/${uniqueIdentifier}` });
    } catch (error) {
      console.error("Erro ao criar link de feedback:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }

  public async submitFeedback(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const feedbackData = req.body;

      if (!isUUID(id)) {
        res.status(400).send("Link inválido.");
        return;
      }

      const feedbackRepository = AppDataSource.getRepository(Feedback);
      const feedback = await feedbackRepository.findOne({
        where: { unique_identifier: id },
      });

      if (!feedback) {
        res.status(404).send("Link inválido.");
        return;
      }

      if (feedback.used) {
        res.status(400).send("Este link já foi utilizado.");
        return;
      }

      feedback.opnion = feedbackData.opnion;
      feedback.note_internet = feedbackData.ratingInternet;
      feedback.note_service = feedbackData.ratingService;
      feedback.note_response_time = feedbackData.ratingResponseTime;
      feedback.note_technician_service = feedbackData.ratingTechnicianService;
      feedback.you_problem_as_solved = feedbackData.ratingDoYouProblemSolved;
      feedback.you_recomend = feedbackData.ratingDoYouRecomend;
      feedback.used = true;
      feedback.time = new Date();

      await feedbackRepository.save(feedback);

      res.status(200).send("Feedback registrado com sucesso.");
    } catch (error) {
      console.error("Erro ao registrar feedback:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }

  public async getFeedbackUUID(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!isUUID(id)) {
        res.status(400).json({ message: "Link inválido.", used: null });
        return;
      }

      const feedbackRepository = AppDataSource.getRepository(Feedback);
      const feedback = await feedbackRepository.findOne({
        where: { unique_identifier: id },
      });

      if (!feedback) {
        res.status(404).json({ message: "Link não encontrado.", used: null });
        return;
      }

      res.status(200).json({ used: feedback.used });
      return;
    } catch (error) {
      console.error("Erro ao verificar feedback:", error);
      res
        .status(500)
        .json({ message: "Erro interno do servidor.", used: null });
      return;
    }
  }

  private getDateRange(period: "month" | "year"): { start: Date; end: Date } {
    const date = new Date();
    if (period === "month") {
      return {
        start: new Date(date.getFullYear(), date.getMonth(), 1),
        end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
      };
    } else {
      return {
        start: new Date(date.getFullYear(), 0, 1),
        end: new Date(date.getFullYear(), 11, 31, 23, 59, 59),
      };
    }
  }

  private async getNote(
    field: keyof Feedback,
    period: "month" | "year",
    res: Response
  ) {
    try {
      const { start, end } = this.getDateRange(period);
      const feedbackRepository = AppDataSource.getRepository(Feedback);

      const feedbackCounts = await feedbackRepository
        .createQueryBuilder("feedback")
        .select(`feedback.${field}`, "note")
        .addSelect("COUNT(*)", "count")
        .where("feedback.time BETWEEN :start AND :end", { start, end })
        .andWhere(`feedback.${field} IS NOT NULL`)
        .groupBy(`feedback.${field}`)
        .orderBy(`feedback.${field}`, "DESC")
        .getRawMany();

      return res.status(200).send(feedbackCounts);
    } catch (error) {
      console.error(`Erro ao buscar feedback para ${field}:`, error);
      return res.status(500).send("Erro interno do servidor.");
    }
  }

  private async getNoteTech(
    field: keyof Feedback,
    tech: string,
    period: "month" | "year",
    res: Response
  ) {
    try {
      const { start, end } = this.getDateRange(period);
      const feedbackRepository = AppDataSource.getRepository(Feedback);
  
      const feedbackCounts = await feedbackRepository
        .createQueryBuilder("feedback")
        .select(`feedback.${field}`, "note")
        .addSelect("COUNT(*)", "count")
        .addSelect("feedback.login", "login") // Adiciona o campo login
        .where("feedback.time BETWEEN :start AND :end", { start, end })
        .andWhere(`feedback.${field} IS NOT NULL`)
        .andWhere("feedback.login = :tech", { tech })
        .groupBy(`feedback.${field}`)
        .addGroupBy("feedback.login") // Adiciona agrupamento pelo login
        .orderBy(`feedback.${field}`, "DESC")
        .getRawMany();
  
      return res.status(200).send(feedbackCounts);
    } catch (error) {
      console.error(`Erro ao buscar feedback para ${field}:`, error);
      return res.status(500).send("Erro interno do servidor.");
    }
  }


  /**
   * Todos os gráficos da tela de avaliações numa requisição só: lê as linhas
   * do período uma vez e conta cada nota aqui, em vez de 6 consultas
   * (6 conexões do pool) por abertura de tela.
   *
   * GET /feedback/resumo?period=month|year&technician=Nome
   */
  public async resumo(req: Request, res: Response) {
    try {
      const period = req.query.period === "year" ? "year" : "month";
      const technician = String(req.query.technician ?? "").trim();
      const { start, end } = this.getDateRange(period);

      const linhas = await AppDataSource.getRepository(Feedback)
        .createQueryBuilder("feedback")
        .select([
          "feedback.login AS login",
          "feedback.note_internet AS note_internet",
          "feedback.note_service AS note_service",
          "feedback.note_response_time AS note_response_time",
          "feedback.note_technician_service AS note_technician_service",
          "feedback.you_problem_as_solved AS you_problem_as_solved",
          "feedback.you_recomend AS you_recomend",
        ])
        .where("feedback.time BETWEEN :start AND :end", { start, end })
        .getRawMany();

      // Colunas antigas em produção podem ser BIT (chega Buffer) ou INT.
      const valor = (v: unknown) => (Buffer.isBuffer(v) ? v[0] : v);
      // Mesma comparação do MySQL (utf8mb4_0900_ai_ci): sem caixa nem acento.
      const nome = (s: unknown) =>
        String(s ?? "")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      // O seletor mostra o nome completo do funcionário ("ARNALDO MARCHI
      // LUCIANO"), mas os links antigos e os da ficha técnica gravaram só o
      // primeiro nome ("Arnaldo"): vale o nome inteiro ou o começo dele.
      const alvo = nome(technician);
      const mesmoTecnico = (login: unknown) => {
        const l = nome(login);
        return !!l && (l === alvo || alvo.startsWith(`${l} `));
      };

      const contar = (campo: string, filtro = (_l: any) => true) => {
        const contagem = new Map<string, { note: unknown; count: number }>();
        for (const linha of linhas) {
          const note = valor(linha[campo]);
          if (note === null || note === undefined || !filtro(linha)) continue;
          const item = contagem.get(String(note)) ?? { note, count: 0 };
          item.count += 1;
          contagem.set(String(note), item);
        }
        return [...contagem.values()].sort(
          (a, b) => Number(b.note) - Number(a.note),
        );
      };

      res.status(200).json({
        internet: contar("note_internet"),
        service: contar("note_service"),
        responseTime: contar("note_response_time"),
        recommend: contar("you_recomend"),
        solved: contar("you_problem_as_solved"),
        technician: technician
          ? contar(
              "note_technician_service",
              (l) => mesmoTecnico(l.login),
            ).map((n) => ({ ...n, login: technician }))
          : [],
      });
    } catch (error) {
      console.error("Erro ao montar resumo de feedback:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }

  public async getNoteInternet_Month(req: Request, res: Response) {
    await this.getNote("note_internet", "month", res);
    return;
  }

  public async getNoteInternet_Year(req: Request, res: Response) {
    await this.getNote("note_internet", "year", res);
    return;
  }

  public async getNoteService_Month(req: Request, res: Response) {
    await this.getNote("note_service", "month", res);
    return;
  }

  public async getNoteService_Year(req: Request, res: Response) {
    await this.getNote("note_service", "year", res);
    return;
  }

  public async getNoteResponseTime_Month(req: Request, res: Response) {
    await this.getNote("note_response_time", "month", res);
    return;
  }

  public async getNoteResponseTime_Year(req: Request, res: Response) {
    await this.getNote("note_response_time", "year", res);
    return;
  }

  public async getTechnician_Month(req: Request, res: Response) {
    const {technician} = req.body    
    await this.getNoteTech("note_technician_service", technician, "month", res);
    return;
  }

  public async getTechnician_Year(req: Request, res: Response) {
    const {technician} = req.body
    await this.getNoteTech("note_technician_service", technician, "year", res);
    return;
  }

  public async doYouProblemAsSolved_Month(req: Request, res: Response) {
    await this.getNote("you_problem_as_solved", "month", res);
    return;
  }

  public async doYouProblemAsSolved_Year(req: Request, res: Response) {
    await this.getNote("you_problem_as_solved", "year", res);
    return;
  }

  public async doYouRecommend_Month(req: Request, res: Response) {
    await this.getNote("you_recomend", "month", res);
    return;
  }

  public async doYouRecommend_Year(req: Request, res: Response) {
    await this.getNote("you_recomend", "year", res);
    return;
  }

  public async feedbackOpnion(req: Request, res: Response) {
    try {
      const { start, end } = this.getDateRange("month");
      const feedbackRepository = AppDataSource.getRepository(Feedback);
      const field = "opnion"
      const feedbackCounts = await feedbackRepository
        .createQueryBuilder("feedback")
        .select(`feedback.${field}`, "opnion")
        .addSelect("COUNT(*)", "count")
        .addSelect("feedback.login", "login")
        .addSelect("feedback.time", "time")
        .where("feedback.time BETWEEN :start AND :end", { start, end })
        .andWhere(`feedback.${field} IS NOT NULL`)
        .groupBy(`feedback.${field}`)
        .addGroupBy("feedback.login")
        .addGroupBy("feedback.time")
        .orderBy(`feedback.${field}`, "DESC")
        .getRawMany();
  
      res.status(200).send(feedbackCounts);
      return;
    } catch (error) {
      console.error(`Erro ao buscar feedback para Opnion:`, error);
      res.status(500).send("Erro interno do servidor.");
      return;
    }
  }

}

export default new FeedbackController();
