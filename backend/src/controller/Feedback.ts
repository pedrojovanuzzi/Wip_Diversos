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
  
  
  

  public async getNoteInternet_Month(req: Request, res: Response) {
    this.getNote("note_internet", "month", res);
    return;
  }

  public async getNoteInternet_Year(req: Request, res: Response) {
    this.getNote("note_internet", "year", res);
    return;
  }

  public async getNoteService_Month(req: Request, res: Response) {
    this.getNote("note_service", "month", res);
    return;
  }

  public async getNoteService_Year(req: Request, res: Response) {
    this.getNote("note_service", "year", res);
    return;
  }

  public async getNoteResponseTime_Month(req: Request, res: Response) {
    this.getNote("note_response_time", "month", res);
    return;
  }

  public async getNoteResponseTime_Year(req: Request, res: Response) {
    this.getNote("note_response_time", "year", res);
    return;
  }

  public async getTechnician_Month(req: Request, res: Response) {
    const {technician} = req.body    
    this.getNoteTech("note_technician_service", technician, "month", res);
    return;
  }

  public async getTechnician_Year(req: Request, res: Response) {
    const {technician} = req.body
    this.getNoteTech("note_technician_service", technician, "year", res);
    return;
  }

}

export default new FeedbackController();
