import { DataSource } from "typeorm";
import dotenv from "dotenv";
import path from "path";
import { CameraCliente } from "../entities/CameraCliente";
import { Camera } from "../entities/Camera";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Banco dedicado das câmeras (wip_cams). Guarda os clientes-câmera e as
 * câmeras cadastradas (tabelas camera_clientes e cameras). Mantido separado
 * do banco principal (wip_diversos).
 */
const CamsSource = new DataSource({
  type: "mysql",
  host: process.env.DATABASE_HOST_CAMS,
  port: 3306,
  username: process.env.DATABASE_USERNAME_CAMS,
  password: process.env.DATABASE_PASSWORD_CAMS,
  database: process.env.DATABASE_CAMS,
  entities: [CameraCliente, Camera],
  synchronize: false,
  extra: {
    connectTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  },
});

CamsSource.initialize()
  .then(() => {
    console.log("Cams Source (wip_cams) has been initialized!");
  })
  .catch((err) => {
    console.error("Error during Cams Source initialization", err);
  });

export default CamsSource;
