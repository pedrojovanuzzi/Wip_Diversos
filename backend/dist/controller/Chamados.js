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
const MkauthSource_1 = __importDefault(require("../database/MkauthSource"));
const ChamadosEntities_1 = require("../entities/ChamadosEntities");
class Chamados {
    showMonth(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const MkRepository = MkauthSource_1.default.getRepository(ChamadosEntities_1.ChamadosEntities);
            const currentDate = new Date();
            const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
            try {
                const Dados = yield MkRepository.createQueryBuilder("chamado")
                    .select("chamado.login")
                    .addSelect("COUNT(chamado.id)", "totalChamados")
                    .where("(chamado.abertura BETWEEN :start AND :end) and not login = 'noc'", {
                    start: firstDayOfMonth,
                    end: lastDayOfMonth,
                })
                    .groupBy("chamado.login")
                    .orderBy("totalChamados", "DESC")
                    .limit(10)
                    .getRawMany();
                res.status(200).json(Dados);
            }
            catch (error) {
                res.status(500).json({ message: 'Erro ao buscar os chamados do mês.', error });
            }
        });
    }
    showYear(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const MkRepository = MkauthSource_1.default.getRepository(ChamadosEntities_1.ChamadosEntities);
            const currentDate = new Date();
            const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
            const lastDayOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59);
            try {
                const Dados = yield MkRepository.createQueryBuilder("chamado")
                    .select("chamado.login")
                    .addSelect("COUNT(chamado.id)", "totalChamados")
                    .where("(chamado.abertura BETWEEN :start AND :end) and not login = 'noc' ", {
                    start: firstDayOfYear,
                    end: lastDayOfYear,
                })
                    .groupBy("chamado.login")
                    .orderBy("totalChamados", "DESC")
                    .limit(10)
                    .getRawMany();
                res.status(200).json(Dados);
            }
            catch (error) {
                res.status(500).json({ message: 'Erro ao buscar os chamados do ano.', error });
            }
        });
    }
    showAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const MkRepository = MkauthSource_1.default.getRepository(ChamadosEntities_1.ChamadosEntities);
            try {
                const Dados = yield MkRepository.createQueryBuilder("chamado")
                    .select("chamado.login")
                    .where("not login = 'noc'")
                    .addSelect("COUNT(chamado.id)", "totalChamados")
                    .groupBy("chamado.login")
                    .orderBy("totalChamados", "DESC")
                    .limit(10)
                    .getRawMany();
                res.status(200).json(Dados);
            }
            catch (error) {
                res.status(500).json({ message: 'Erro ao buscar os chamados do ano.', error });
            }
        });
    }
}
exports.default = new Chamados();
