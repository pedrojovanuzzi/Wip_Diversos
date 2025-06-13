import { DataSource } from "typeorm"
import dotenv from "dotenv";
import { ChamadosEntities } from "../entities/ChamadosEntities";
import { ClientesEntities } from "../entities/ClientesEntities";
import { FuncionariosEntities } from "../entities/FuncionariosEntities";
import { Faturas } from "../entities/Faturas";
import {Radacct} from "../entities/Radacct"

dotenv.config();

const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DATABASE_HOST_API,
    port: 3306,
    username: process.env.DATABASE_USERNAME_API,
    password: process.env.DATABASE_PASSWORD_API,
    entities: [ChamadosEntities, ClientesEntities, FuncionariosEntities, Faturas, Radacct],
    synchronize: false,
    database: process.env.DATABASE_API,
})

AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!")
    })
    .catch((err) => {
        console.error("Error during Data Source initialization", err)
    })


export default AppDataSource;