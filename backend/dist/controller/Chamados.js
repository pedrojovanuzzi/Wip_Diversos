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
const ClientesEntities_1 = require("../entities/ClientesEntities");
const FuncionariosEntities_1 = require("../entities/FuncionariosEntities");
class Chamados {
    showMonth(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const MkRepository = MkauthSource_1.default.getRepository(ChamadosEntities_1.ChamadosEntities);
            const currentDate = new Date();
            const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
            const ClientRepository = MkauthSource_1.default.getRepository(ClientesEntities_1.ClientesEntities);
            const ClientsDisabled = yield ClientRepository.find({
                where: { cli_ativado: "n" },
                select: ['login']
            });
            const disabledLogins = ClientsDisabled.map(client => client.login);
            try {
                const Dados = yield MkRepository.createQueryBuilder("chamado")
                    .select("chamado.login")
                    .addSelect("COUNT(chamado.id)", "totalChamados")
                    .where("chamado.abertura BETWEEN :start AND :end", {
                    start: firstDayOfMonth,
                    end: lastDayOfMonth,
                })
                    .andWhere("chamado.login != 'noc'")
                    .andWhere("chamado.login NOT IN (:...disabledLogins)", { disabledLogins }) // Exclui logins desativados
                    .groupBy("chamado.login")
                    .orderBy("totalChamados", "DESC")
                    .limit(10)
                    .getRawMany();
                res.status(200).json(Dados);
            }
            catch (error) {
                res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
            }
        });
    }
    showYear(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const MkRepository = MkauthSource_1.default.getRepository(ChamadosEntities_1.ChamadosEntities);
            const currentDate = new Date();
            const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
            const lastDayOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59);
            const ClientRepository = MkauthSource_1.default.getRepository(ClientesEntities_1.ClientesEntities);
            const ClientsDisabled = yield ClientRepository.find({
                where: { cli_ativado: "n" },
                select: ['login']
            });
            const disabledLogins = ClientsDisabled.map(client => client.login);
            try {
                const Dados = yield MkRepository.createQueryBuilder("chamado")
                    .select("chamado.login")
                    .addSelect("COUNT(chamado.id)", "totalChamados")
                    .where("(chamado.abertura BETWEEN :start AND :end)", {
                    start: firstDayOfYear,
                    end: lastDayOfYear,
                })
                    .andWhere("chamado.login != 'noc'")
                    .andWhere("chamado.login NOT IN (:...disabledLogins)", { disabledLogins })
                    .groupBy("chamado.login")
                    .orderBy("totalChamados", "DESC")
                    .limit(10)
                    .getRawMany();
                res.status(200).json(Dados);
            }
            catch (error) {
                res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
            }
        });
    }
    showAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const MkRepository = MkauthSource_1.default.getRepository(ChamadosEntities_1.ChamadosEntities);
            const ClientRepository = MkauthSource_1.default.getRepository(ClientesEntities_1.ClientesEntities);
            const ClientsDisabled = yield ClientRepository.find({
                where: { cli_ativado: "n" },
                select: ['login']
            });
            const disabledLogins = ClientsDisabled.map(client => client.login);
            try {
                const Dados = yield MkRepository.createQueryBuilder("chamado")
                    .select("chamado.login")
                    .where("chamado.login != 'noc'")
                    .andWhere("chamado.login NOT IN (:...disabledLogins)", { disabledLogins })
                    .addSelect("COUNT(chamado.id)", "totalChamados")
                    .groupBy("chamado.login")
                    .orderBy("totalChamados", "DESC")
                    .limit(10)
                    .getRawMany();
                res.status(200).json(Dados);
            }
            catch (error) {
                res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
            }
        });
    }
    returnMonth(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const MkRepository = MkauthSource_1.default.getRepository(ChamadosEntities_1.ChamadosEntities);
            const currentDate = new Date();
            const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
            try {
                const Dados = yield MkRepository.createQueryBuilder("chamado")
                    .select("func.nome", "tecnicoNome")
                    .addSelect("COUNT(chamado.id)", "totalChamados")
                    .innerJoin(FuncionariosEntities_1.FuncionariosEntities, "func", "chamado.tecnico = func.id")
                    .where("chamado.abertura BETWEEN :start AND :end", {
                    start: firstDayOfMonth,
                    end: lastDayOfMonth,
                })
                    .andWhere("chamado.login != 'noc'")
                    .andWhere("chamado.tecnico != 0")
                    .andWhere("chamado.assunto = :assunto", { assunto: 'retorno' }) // Filtro para o assunto "retorno"
                    .groupBy("func.nome")
                    .orderBy("totalChamados", "DESC")
                    .limit(10)
                    .getRawMany();
                res.status(200).json(Dados);
            }
            catch (error) {
                res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
            }
        });
    }
    returnYear(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const MkRepository = MkauthSource_1.default.getRepository(ChamadosEntities_1.ChamadosEntities);
            const currentDate = new Date();
            const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
            const lastDayOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59);
            try {
                const Dados = yield MkRepository.createQueryBuilder("chamado")
                    .select("func.nome", "tecnicoNome") // Seleciona o nome do técnico
                    .addSelect("COUNT(chamado.id)", "totalChamados")
                    .innerJoin(FuncionariosEntities_1.FuncionariosEntities, "func", "chamado.tecnico = func.id") // Faz o join com a entidade FuncionariosEntities
                    .where("chamado.abertura BETWEEN :start AND :end", {
                    start: firstDayOfYear,
                    end: lastDayOfYear,
                })
                    .andWhere("chamado.login != 'noc'")
                    .andWhere("chamado.tecnico != 0")
                    .andWhere("chamado.assunto = :assunto", { assunto: 'retorno' }) // Filtro para o assunto "retorno"
                    .groupBy("func.nome") // Agrupa pelo nome do técnico
                    .orderBy("totalChamados", "DESC")
                    .limit(10)
                    .getRawMany();
                res.status(200).json(Dados);
            }
            catch (error) {
                res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
            }
        });
    }
}
exports.default = new Chamados();
