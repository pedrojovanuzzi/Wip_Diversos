import { DataSource } from "typeorm";
import dotenv from "dotenv";
import path from "path";
import { User } from "../entities/User";
import { Feedback } from "../entities/NotaColaboradores";
import { NFSE } from "../entities/NFSE";
import { PrefeituraUser } from "../entities/PrefeituraUser";
import { DDDOS_MonitoringEntities } from "../entities/DDDOS_Monitoring";
import { NFCom } from "../entities/NFCom";
import { Jobs } from "../entities/Jobs";
import { Employee } from "../entities/Employee";
import { TimeRecord } from "../entities/TimeRecord";
import { DailyOvertime } from "../entities/DailyOvertime";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DATABASE_HOST,

  port: 3306,
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
  entities: [
    User,
    Feedback,
    NFSE,
    PrefeituraUser,
    DDDOS_MonitoringEntities,
    NFCom,
    Jobs,
    Employee,
    TimeRecord,
    DailyOvertime,
  ],
  migrations: [path.join(__dirname, "../migration/*.{ts,js}")],
});

AppDataSource.initialize()
  .then(() => {
    console.log("Data Source has been initialized!");
  })
  .catch((err) => {
    console.error("Error during Data Source initialization", err);
  });

export default AppDataSource;
