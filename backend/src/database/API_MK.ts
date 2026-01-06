import "reflect-metadata";

import { DataSource } from "typeorm";
import dotenv from "dotenv";
import path from "path";

import ConverSation_Users from "../entities/APIMK/Conversation_Users";
import Conversations from "../entities/APIMK/Conversations";
import Messages from "../entities/APIMK/Mensagens";
import PeopleConversations from "../entities/APIMK/People_Conversations";
import Sessions from "../entities/APIMK/Sessions";

dotenv.config();

const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DATABASE_HOST,
  port: 3306,
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
  entities: [
    ConverSation_Users,
    Conversations,
    Messages,
    PeopleConversations,
    Sessions,
  ],
  migrations: [path.join(__dirname, "../migration/*.ts")],
});

AppDataSource.initialize()
  .then(() => {
    console.log("Data Source has been initialized!");
  })
  .catch((err) => {
    console.error("Error during Data Source initialization", err);
  });

export default AppDataSource;
