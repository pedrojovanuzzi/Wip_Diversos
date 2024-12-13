import { Request, Response } from "express";
import { Feedback } from "../entities/NotaColaboradores";
import { isUUID } from "class-validator";
import AppDataSource from "../database/DataSource";
import { v4 as uuidv4 } from "uuid";

class FeedbackController {
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
}

export default new FeedbackController();
