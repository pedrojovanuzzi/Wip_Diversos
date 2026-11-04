import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { ChamadosEntities } from "../entities/ChamadosEntities";
import { ClientesEntities } from "../entities/ClientesEntities";
import { FuncionariosEntities } from "../entities/FuncionariosEntities";
import { Faturas } from "../entities/Faturas";
import { Radacct } from "../entities/Radacct";
import { Sis_prodCliente } from "../entities/Sis_prodCliente";
import { SisProduto } from "../entities/SisProduto";
import { SisPlano } from "../entities/SisPlano";
import { SisMsg } from "../entities/SisMsg";
import { SisSerContratos } from "../entities/SisSerContratos";

dotenv.config();

// MKAUTH_TESTE=true troca o MK-Auth de verdade pelo banco local criado por
// scripts/mkauth-teste.ts. As variáveis *_API ficam intactas: o Redis do
// WhatsApp e o backup também as usam.
const TESTE = process.env.MKAUTH_TESTE === "true";
if (TESTE) {
  console.warn(
    `⚠️  MK-Auth de TESTE: ${process.env.MKAUTH_TESTE_HOST || "127.0.0.1"}/${process.env.MKAUTH_TESTE_DATABASE || "mkradius_teste"}`,
  );
}

const AppDataSource = new DataSource({
  type: "mysql",
  host: TESTE
    ? process.env.MKAUTH_TESTE_HOST || "127.0.0.1"
    : process.env.DATABASE_HOST_API,
  port: TESTE ? Number(process.env.MKAUTH_TESTE_PORT || 3306) : 3306,
  username: TESTE
    ? process.env.MKAUTH_TESTE_USER || "root"
    : process.env.DATABASE_USERNAME_API,
  password: TESTE
    ? process.env.MKAUTH_TESTE_PASSWORD || ""
    : process.env.DATABASE_PASSWORD_API,
  entities: [
    ChamadosEntities,
    ClientesEntities,
    FuncionariosEntities,
    Faturas,
    Radacct,
    Sis_prodCliente,
    SisProduto,
    SisPlano,
    SisMsg,
    SisSerContratos,
  ],
  synchronize: false,
  database: TESTE
    ? process.env.MKAUTH_TESTE_DATABASE || "mkradius_teste"
    : process.env.DATABASE_API,
  // Aumenta tolerancia a queries pesadas no radacct (busca por IP).
  extra: {
    connectTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  },
  maxQueryExecutionTime: 120_000,
});

AppDataSource.initialize()
  .then(() => {
    console.log("Data Source has been initialized!");
  })
  .catch((err) => {
    console.error("Error during Data Source initialization", err);
  });

export default AppDataSource;
