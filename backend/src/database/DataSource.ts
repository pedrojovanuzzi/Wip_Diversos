import { DataSource } from "typeorm";
import dotenv from "dotenv";
import path from "path"; // Importando o 'path' para manipular caminhos

dotenv.config();

const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DATABASE_HOST,
    port: 3306,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
    entities: [path.join(__dirname, "../entities/*.ts")], // Caminho absoluto para as entidades
    migrations: [path.join(__dirname, "../migration/*.ts")], // Caminho absoluto para as migrações
})

AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");
    })
    .catch((err) => {
        console.error("Error during Data Source initialization", err);
    });

export default AppDataSource;
