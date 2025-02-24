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
const express_validator_1 = require("express-validator");
const DataSource_1 = __importDefault(require("../database/DataSource"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../entities/User");
dotenv_1.default.config();
const jwtSecret = String(process.env.JWT_SECRET);
function generateToken(id) {
    return jsonwebtoken_1.default.sign({ id }, jwtSecret, { expiresIn: "7d" });
}
class Auth {
    show(req, res) {
        res.json("Auth Page");
    }
    createUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield (0, express_validator_1.body)('login').trim().escape().notEmpty().withMessage('Login é Obrigatorio').run(req);
                yield (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Senha tem que ter no Minimo 6 Caracteres').run(req);
                const errors = (0, express_validator_1.validationResult)(req);
                if (!errors.isEmpty()) {
                    res.status(400).json({ errors: errors.array() });
                }
                let errorsArray = (0, express_validator_1.validationResult)(req).array();
                const { login, password } = req.body;
                const userRepository = DataSource_1.default.getRepository(User_1.User);
                const user = yield userRepository.findOne({ where: { login: login } });
                if (user) {
                    errorsArray.push({
                        type: "field",
                        value: "",
                        path: "user",
                        msg: "Por favor, utilize outro e-mail",
                        location: "body" // Onde o erro ocorreu (corpo da requisição)
                    });
                    res.status(422).json({ errors: errorsArray });
                    return;
                }
                const salt = yield bcrypt_1.default.genSalt();
                const passwordHash = yield bcrypt_1.default.hash(password, salt);
                const newUser = userRepository.create({
                    login,
                    password: passwordHash
                });
                const savedUser = yield userRepository.save(newUser);
                if (!savedUser) {
                    errorsArray.push({
                        type: "field",
                        value: "",
                        path: "user",
                        msg: "Houve um Erro, por favor tente mais tarde",
                        location: "body" // Onde o erro ocorreu (corpo da requisição)
                    });
                    res.status(422).json({ errors: errorsArray });
                    return;
                }
                res.status(201).json({ message: 'User created successfully', id: newUser.id, user: { login }, token: generateToken(String(newUser.id)) });
            }
            catch (error) {
                res.status(401).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
            }
        });
    }
    getToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const authHeader = req.headers['authorization'];
                const token = authHeader && authHeader.split(' ')[1];
                if (!token) {
                    res.status(401).json({ valid: false });
                    return;
                }
                jsonwebtoken_1.default.verify(token, String(process.env.JWT_SECRET), (err, decoded) => {
                    if (err) {
                        res.status(401).json({ valid: false });
                        return;
                    }
                    res.json({ valid: true });
                    return;
                });
            }
            catch (error) {
                res.status(401).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
            }
        });
    }
    Login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield (0, express_validator_1.body)('login').trim().escape().notEmpty().withMessage('Login é Obrigatorio').run(req);
                yield (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Senha tem que ter no Minimo 6 Caracteres').run(req);
                const errors = (0, express_validator_1.validationResult)(req);
                if (!errors.isEmpty()) {
                    res.status(400).json({ errors: errors.array() });
                    return;
                }
                const { login, password } = req.body;
                const userRepository = DataSource_1.default.getRepository(User_1.User);
                const user = yield userRepository.findOne({ where: { login: login } });
                let errorsArray = (0, express_validator_1.validationResult)(req).array();
                if (!user) {
                    errorsArray.push({
                        type: "field",
                        value: "",
                        path: "user",
                        msg: "Usuário não encontrado",
                        location: "body" // Onde o erro ocorreu (corpo da requisição)
                    });
                    res.status(422).json({ errors: errorsArray });
                    return;
                }
                if (!(yield bcrypt_1.default.compare(password, String(user.password)))) {
                    errorsArray.push({
                        type: "field",
                        value: "",
                        path: "user",
                        msg: "Senha Inválida",
                        location: "body"
                    });
                    res.status(422).json({ errors: errorsArray });
                    return;
                }
                res.status(201).json({
                    id: user.id,
                    login: user.login,
                    token: generateToken(String(user.id))
                });
            }
            catch (error) {
                res.status(401).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
            }
        });
    }
    getCurrentUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = req.user;
                res.status(200).json(user);
            }
            catch (error) {
                res.status(401).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
            }
        });
    }
}
exports.default = new Auth();
