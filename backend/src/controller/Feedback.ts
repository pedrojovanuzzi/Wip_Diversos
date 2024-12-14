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

  private getMonthDateRange(date: Date): {
    startOfMonth: Date;
    endOfMonth: Date;
  } {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    return { startOfMonth, endOfMonth };
  }

  private getYearDateRange(date: Date): { startOfYear: Date; endOfYear: Date } {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const endOfYear = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { startOfYear, endOfYear };
  }

  public async getNoteInternet_Month(req: Request, res: Response) {
    try {
      const { startOfMonth, endOfMonth } = this.getMonthDateRange(new Date());
      const feedbackRepository = AppDataSource.getRepository(Feedback);
      const feedbackCounts = await feedbackRepository
        .createQueryBuilder("feedback")
        .select("feedback.note_internet", "note")
        .addSelect("COUNT(*)", "count")
        .where("feedback.time BETWEEN :start AND :end", {
          start: startOfMonth,
          end: endOfMonth,
        })
        .andWhere("feedback.note_internet IS NOT NULL")
        .groupBy("feedback.note_internet")
        .orderBy("feedback.note_internet", "DESC")
        .getRawMany();
      res.status(200).send(feedbackCounts);
    } catch (error) {
      console.error("Erro ao buscar feedback mensal:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }

  public async getNoteInternet_Year(req: Request, res: Response) {
    try {
      const { startOfYear, endOfYear } = this.getYearDateRange(new Date());
      const feedbackRepository = AppDataSource.getRepository(Feedback);
      const feedbackCounts = await feedbackRepository
        .createQueryBuilder("feedback")
        .select("feedback.note_internet", "note")
        .addSelect("COUNT(*)", "count")
        .where("feedback.time BETWEEN :start AND :end", {
          start: startOfYear,
          end: endOfYear,
        })
        .andWhere("feedback.note_internet IS NOT NULL")
        .groupBy("feedback.note_internet")
        .orderBy("feedback.note_internet", "DESC")
        .getRawMany();
      res.status(200).send(feedbackCounts);
    } catch (error) {
      console.error("Erro ao buscar feedback Anual:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }

  public async getNoteService_Month(req: Request, res: Response) {
    try {
      const { startOfMonth, endOfMonth } = this.getMonthDateRange(new Date());
      const feedbackRepository = AppDataSource.getRepository(Feedback);
      const feedbackCounts = await feedbackRepository
        .createQueryBuilder("feedback")
        .select("feedback.note_service", "note")
        .addSelect("COUNT(*)", "count")
        .where("feedback.time BETWEEN :start AND :end", {
          start: startOfMonth,
          end: endOfMonth,
        })
        .andWhere("feedback.note_service IS NOT NULL")
        .groupBy("feedback.note_service")
        .orderBy("feedback.note_service", "DESC")
        .getRawMany();
      res.status(200).send(feedbackCounts);
    } catch (error) {
      console.error("Erro ao buscar feedback mensal:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }

  public async getNoteService_Year(req: Request, res: Response) {
    try {
      const { startOfYear, endOfYear } = this.getYearDateRange(new Date());
      const feedbackRepository = AppDataSource.getRepository(Feedback);
      const feedbackCounts = await feedbackRepository
        .createQueryBuilder("feedback")
        .select("feedback.note_service", "note")
        .addSelect("COUNT(*)", "count")
        .where("feedback.time BETWEEN :start AND :end", {
          start: startOfYear,
          end: endOfYear,
        })
        .andWhere("feedback.note_service IS NOT NULL")
        .groupBy("feedback.note_service")
        .orderBy("feedback.note_service", "DESC")
        .getRawMany();
      res.status(200).send(feedbackCounts);
    } catch (error) {
      console.error("Erro ao buscar feedback Anual:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }

  public async getNoteResponseTime_Month(req: Request, res: Response) {
    try {
      const { startOfMonth, endOfMonth } = this.getMonthDateRange(new Date());
      const feedbackRepository = AppDataSource.getRepository(Feedback);
      const feedbackCounts = await feedbackRepository
        .createQueryBuilder("feedback")
        .select("feedback.note_response_time", "note")
        .addSelect("COUNT(*)", "count")
        .where("feedback.time BETWEEN :start AND :end", {
          start: startOfMonth,
          end: endOfMonth,
        })
        .andWhere("feedback.note_response_time IS NOT NULL")
        .groupBy("feedback.note_response_time")
        .orderBy("feedback.note_response_time", "DESC")
        .getRawMany();
      res.status(200).send(feedbackCounts);
    } catch (error) {
      console.error("Erro ao buscar feedback mensal:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }

  public async getNoteResponseTime_Year(req: Request, res: Response) {
    try {
      const { startOfYear, endOfYear } = this.getYearDateRange(new Date());
      const feedbackRepository = AppDataSource.getRepository(Feedback);
      const feedbackCounts = await feedbackRepository
        .createQueryBuilder("feedback")
        .select("feedback.note_response_time", "note")
        .addSelect("COUNT(*)", "count")
        .where("feedback.time BETWEEN :start AND :end", {
          start: startOfYear,
          end: endOfYear,
        })
        .andWhere("feedback.note_response_time IS NOT NULL")
        .groupBy("feedback.note_response_time")
        .orderBy("feedback.note_response_time", "DESC")
        .getRawMany();
      res.status(200).send(feedbackCounts);
      console.log(feedbackCounts);
      
    } catch (error) {
      console.error("Erro ao buscar feedback Anual:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }
}

export default new FeedbackController();
