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
exports.App = void 0;
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const Chamados_Routes_1 = __importDefault(require("./routes/Chamados.Routes")); // Caminho correto para o arquivo de rotas
const Home_Routes_1 = __importDefault(require("./routes/Home.Routes"));
const Auth_Routes_1 = __importDefault(require("./routes/Auth.Routes"));
const cors_1 = __importDefault(require("cors"));
const Feedback_routes_1 = __importDefault(require("./routes/Feedback.routes"));
const NFSE_routes_1 = __importDefault(require("./routes/NFSE.routes"));
const Whatsapp_Routes_1 = __importDefault(require("./routes/Whatsapp.Routes"));
const PrefeituraUser_routes_1 = __importDefault(require("./routes/PrefeituraUser.routes"));
const ClientAnalytics_routes_1 = __importDefault(require("./routes/ClientAnalytics.routes"));
const node_cron_1 = __importDefault(require("node-cron"));
const Backup_1 = __importDefault(require("./controller/Backup")); // Caminho para sua classe de backup
const DosProtect_Routes_1 = __importDefault(require("./routes/DosProtect.Routes"));
const ServerLogs_Routes_1 = __importDefault(require("./routes/ServerLogs.Routes"));
const PowerDns_routes_1 = __importDefault(require("./routes/PowerDns.routes"));
const Onu_routes_1 = __importDefault(require("./routes/Onu.routes"));
const Backup_routes_1 = __importDefault(require("./routes/Backup.routes"));
const backup = new Backup_1.default();
class App {
    constructor() {
        this.server = (0, express_1.default)();
        this.middleware();
        this.router();
        this.agendarBackup();
        // this.verificaDDOS();
    }
    middleware() {
        this.server.use(express_1.default.json());
        this.server.use(express_1.default.urlencoded({ extended: true }));
        this.server.use((0, cors_1.default)({ origin: process.env.URL }));
    }
    router() {
        this.server.use("/api/chamados", Chamados_Routes_1.default);
        this.server.use("/api/", Home_Routes_1.default);
        this.server.use("/api/auth", Auth_Routes_1.default);
        this.server.use("/api/feedback", Feedback_routes_1.default);
        this.server.use("/api/Nfe", NFSE_routes_1.default);
        this.server.use("/api/whatsapp", Whatsapp_Routes_1.default);
        this.server.use("/api/Prefeitura", PrefeituraUser_routes_1.default);
        this.server.use("/api/ClientAnalytics", ClientAnalytics_routes_1.default);
        this.server.use("/api/DosProtect", DosProtect_Routes_1.default);
        this.server.use("/api/ServerLogs", ServerLogs_Routes_1.default);
        this.server.use("/api/PowerDns", PowerDns_routes_1.default);
        this.server.use("/api/Onu", Onu_routes_1.default);
        this.server.use("/api/Backup", Backup_routes_1.default);
    }
    agendarBackup() {
        // 🕒 Agendar para todo dia às 03:00
        node_cron_1.default.schedule("0 3 * * *", () => __awaiter(this, void 0, void 0, function* () {
            console.log("⏰ Executando backup automático", new Date().toLocaleString());
            try {
                yield backup.gerarTodos();
            }
            catch (err) {
                console.error("❌ Falha no backup agendado:", err);
            }
        }));
        console.log("📅 Agendador de backup inicializado.");
    }
}
exports.App = App;
