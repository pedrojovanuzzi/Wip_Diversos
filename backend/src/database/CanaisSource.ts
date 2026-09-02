import { DataSource } from "typeorm";
import dotenv from "dotenv";
import path from "path";
import { Canal } from "../entities/Canal";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Banco dos canais da TV WIP (wip_canais), usado hoje pelo sistema em PHP
 * (repositório TV_WIP2). Só lemos e editamos `tb_canais` — os pacotes e os
 * vínculos com clientes ficam no banco do sistema.
 *
 * Não confundir com o streaming pago da Watch Brasil.
 */
const CanaisSource = new DataSource({
  type: "mysql",
  host: process.env.DATABASE_HOST_TVWIP,
  port: 3306,
  username: process.env.DATABASE_USERNAME_TVWIP,
  password: process.env.DATABASE_PASSWORD_TVWIP,
  database: process.env.DATABASE_TVWIP,
  entities: [Canal],
  synchronize: false,
  extra: {
    connectTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  },
});

CanaisSource.initialize()
  .then(() => console.log("Canais Source (wip_canais) has been initialized!"))
  .catch((err) =>
    console.error("Error during Canais Source initialization", err),
  );

export default CanaisSource;
