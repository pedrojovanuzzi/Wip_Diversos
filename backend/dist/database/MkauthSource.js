"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
const ChamadosEntities_1 = require("../entities/ChamadosEntities");
dotenv_1.default.config();
const AppDataSource = new typeorm_1.DataSource({
    type: "mysql",
    host: process.env.DATABASE_HOST_API,
    port: 3306,
    username: process.env.DATABASE_USERNAME_API,
    password: process.env.DATABASE_PASSWORD_API,
    entities: [ChamadosEntities_1.ChamadosEntities],
    synchronize: false,
    database: process.env.DATABASE_API,
});
AppDataSource.initialize()
    .then(() => {
    console.log("Data Source has been initialized!");
})
    .catch((err) => {
    console.error("Error during Data Source initialization", err);
});
exports.default = AppDataSource;