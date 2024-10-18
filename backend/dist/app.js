"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const express_1 = __importDefault(require("express"));
const Chamados_Routes_1 = __importDefault(require("./routes/Chamados.Routes")); // Caminho correto para o arquivo de rotas
const Home_Routes_1 = __importDefault(require("./routes/Home.Routes"));
const Auth_Routes_1 = __importDefault(require("./routes/Auth.Routes"));
const cors_1 = __importDefault(require("cors"));
class App {
    constructor() {
        this.server = (0, express_1.default)();
        this.middleware();
        this.router();
    }
    middleware() {
        this.server.use(express_1.default.json());
        this.server.use((0, cors_1.default)({ origin: process.env.URL }));
    }
    router() {
        this.server.use("/api/chamados", Chamados_Routes_1.default);
        this.server.use("/api/", Home_Routes_1.default);
        this.server.use("/api/auth", Auth_Routes_1.default);
    }
}
exports.App = App;
