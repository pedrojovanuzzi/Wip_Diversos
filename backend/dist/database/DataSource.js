"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const User_1 = require("../entities/User");
const NotaColaboradores_1 = require("../entities/NotaColaboradores");
const NFSE_1 = require("../entities/NFSE");
const PrefeituraUser_1 = require("../entities/PrefeituraUser");
dotenv_1.default.config();
const AppDataSource = new typeorm_1.DataSource({
    type: "mysql",
    host: process.env.DATABASE_HOST,
    port: 3306,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
    entities: [User_1.User, NotaColaboradores_1.Feedback, NFSE_1.NFSE, PrefeituraUser_1.PrefeituraUser],
    migrations: [path_1.default.join(__dirname, "../migration/*.ts")],
});
AppDataSource.initialize()
    .then(() => {
    console.log("Data Source has been initialized!");
})
    .catch((err) => {
    console.error("Error during Data Source initialization", err);
});
exports.default = AppDataSource;
