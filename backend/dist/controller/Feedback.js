"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const NotaColaboradores_1 = require("../entities/NotaColaboradores");
const class_validator_1 = require("class-validator");
const DataSource_1 = __importDefault(require("../database/DataSource"));
const uuid_1 = require("uuid");
class FeedbackController {
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
    }
    createFeedbackLink(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { technician } = req.body;
                if (!technician) {
                    res.status(400).send("Técnico é obrigatório.");
                    return;
                }
                const uniqueIdentifier = (0, uuid_1.v4)();
                const feedbackRepository = DataSource_1.default.getRepository(NotaColaboradores_1.Feedback);
                const feedback = feedbackRepository.create({
                    unique_identifier: uniqueIdentifier,
                    login: technician,
                });
                yield feedbackRepository.save(feedback);
                res
                    .status(201)
                    .send({ link: `/feedback/${technician}/${uniqueIdentifier}` });
            }
            catch (error) {
                console.error("Erro ao criar link de feedback:", error);
                res.status(500).send("Erro interno do servidor.");
            }
        });
    }
    submitFeedback(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const feedbackData = req.body;
                if (!(0, class_validator_1.isUUID)(id)) {
                    res.status(400).send("Link inválido.");
                    return;
                }
                const feedbackRepository = DataSource_1.default.getRepository(NotaColaboradores_1.Feedback);
                const feedback = yield feedbackRepository.findOne({
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
                yield feedbackRepository.save(feedback);
                res.status(200).send("Feedback registrado com sucesso.");
            }
            catch (error) {
                console.error("Erro ao registrar feedback:", error);
                res.status(500).send("Erro interno do servidor.");
            }
        });
    }
    getFeedbackUUID(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!(0, class_validator_1.isUUID)(id)) {
                    res.status(400).json({ message: "Link inválido.", used: null });
                    return;
                }
                const feedbackRepository = DataSource_1.default.getRepository(NotaColaboradores_1.Feedback);
                const feedback = yield feedbackRepository.findOne({
                    where: { unique_identifier: id },
                });
                if (!feedback) {
                    res.status(404).json({ message: "Link não encontrado.", used: null });
                    return;
                }
                res.status(200).json({ used: feedback.used });
                return;
            }
            catch (error) {
                console.error("Erro ao verificar feedback:", error);
                res
                    .status(500)
                    .json({ message: "Erro interno do servidor.", used: null });
                return;
            }
        });
    }
    getDateRange(period) {
        const date = new Date();
        if (period === "month") {
            return {
                start: new Date(date.getFullYear(), date.getMonth(), 1),
                end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
            };
        }
        else {
            return {
                start: new Date(date.getFullYear(), 0, 1),
                end: new Date(date.getFullYear(), 11, 31, 23, 59, 59),
            };
        }
    }
    getNote(field, period, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { start, end } = this.getDateRange(period);
                const feedbackRepository = DataSource_1.default.getRepository(NotaColaboradores_1.Feedback);
                const feedbackCounts = yield feedbackRepository
                    .createQueryBuilder("feedback")
                    .select(`feedback.${field}`, "note")
                    .addSelect("COUNT(*)", "count")
                    .where("feedback.time BETWEEN :start AND :end", { start, end })
                    .andWhere(`feedback.${field} IS NOT NULL`)
                    .groupBy(`feedback.${field}`)
                    .orderBy(`feedback.${field}`, "DESC")
                    .getRawMany();
                return res.status(200).send(feedbackCounts);
            }
            catch (error) {
                console.error(`Erro ao buscar feedback para ${field}:`, error);
                return res.status(500).send("Erro interno do servidor.");
            }
        });
    }
    getNoteTech(field, tech, period, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { start, end } = this.getDateRange(period);
                const feedbackRepository = DataSource_1.default.getRepository(NotaColaboradores_1.Feedback);
                const feedbackCounts = yield feedbackRepository
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
            }
            catch (error) {
                console.error(`Erro ao buscar feedback para ${field}:`, error);
                return res.status(500).send("Erro interno do servidor.");
            }
        });
    }
    getNoteInternet_Month(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("note_internet", "month", res);
            return;
        });
    }
    getNoteInternet_Year(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("note_internet", "year", res);
            return;
        });
    }
    getNoteService_Month(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("note_service", "month", res);
            return;
        });
    }
    getNoteService_Year(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("note_service", "year", res);
            return;
        });
    }
    getNoteResponseTime_Month(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("note_response_time", "month", res);
            return;
        });
    }
    getNoteResponseTime_Year(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("note_response_time", "year", res);
            return;
        });
    }
    getTechnician_Month(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { technician } = req.body;
            this.getNoteTech("note_technician_service", technician, "month", res);
            return;
        });
    }
    getTechnician_Year(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { technician } = req.body;
            this.getNoteTech("note_technician_service", technician, "year", res);
            return;
        });
    }
    doYouProblemAsSolved_Month(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("you_problem_as_solved", "month", res);
            return;
        });
    }
    doYouProblemAsSolved_Year(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("you_problem_as_solved", "year", res);
            return;
        });
    }
    doYouRecommend_Month(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("you_recomend", "month", res);
            return;
        });
    }
    doYouRecommend_Year(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getNote("you_recomend", "year", res);
            return;
        });
    }
    feedbackOpnion(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { start, end } = this.getDateRange("month");
                const feedbackRepository = DataSource_1.default.getRepository(NotaColaboradores_1.Feedback);
                const field = "opnion";
                const feedbackCounts = yield feedbackRepository
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
            }
            catch (error) {
                console.error(`Erro ao buscar feedback para Opnion:`, error);
                res.status(500).send("Erro interno do servidor.");
                return;
            }
        });
    }
}
exports.default = new FeedbackController();
