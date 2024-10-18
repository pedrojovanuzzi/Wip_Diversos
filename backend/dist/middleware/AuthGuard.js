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
const User_1 = require("../entities/User");
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const DataSource_1 = __importDefault(require("../database/DataSource"));
dotenv_1.default.config();
const jwtSecret = String(process.env.JWT_SECRET);
function AuthGuard(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const AuthHeader = req.headers["authorization"];
        const token = AuthHeader && AuthHeader.split(" ")[1];
        if (!token) {
            res.status(401).json({ errors: ["Acesso Negado!"] });
            return;
        }
        try {
            const verified = jsonwebtoken_1.default.verify(token, jwtSecret);
            const userRepository = DataSource_1.default.getRepository(User_1.User);
            req.user = yield userRepository.findOne({
                where: { id: verified.id },
                select: ['id', 'login', 'password'],
            });
            if (!req.user) {
                res.status(401).json({ errors: ["Usuário não encontrado"] });
                return;
            }
            next();
        }
        catch (error) {
            res.status(401).json({ errors: ["Token Inválido"] });
        }
    });
}
exports.default = AuthGuard;
