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
import { MonthlyReportSignature } from "../entities/MonthlyReportSignature";
import { NFE } from "../entities/NFE";
import { LicencaEntity } from "../entities/LicencaEntities";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { ChamadoFichaTecnica } from "../entities/ChamadoFichaTecnica";
import { PhoneLocation } from "../entities/PhoneLocation";
import { TotemPixSolicitacao } from "../entities/TotemPixSolicitacao";
import { StreamingAssinante } from "../entities/StreamingAssinante";
import { DeclaracaoQuitacao } from "../entities/DeclaracaoQuitacao";
import { CameraCliente } from "../entities/CameraCliente";
import { Camera } from "../entities/Camera";

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
    MonthlyReportSignature,
    NFE,
    LicencaEntity,
    SolicitacaoServico,
    ChamadoFichaTecnica,
    PhoneLocation,
    TotemPixSolicitacao,
    StreamingAssinante,
    DeclaracaoQuitacao,
    CameraCliente,
    Camera,
  ],
  migrations: [
    path.join(__dirname, "../migration/*.{ts,js}").replace(/\\/g, "/"),
  ],
});

AppDataSource.initialize()
  .then(async () => {
    console.log("Data Source has been initialized!");

    // Cleanup stale jobs
    const jobsRepo = AppDataSource.getRepository(Jobs);
    const result = await jobsRepo
      .createQueryBuilder()
      .update(Jobs)
      .set({
        status: "interrompido",
        description: () =>
          "CONCAT(description, ' [Interrompido por reinicialização]')",
      })
      .where("status = :status", { status: "processando" })
      .execute();

    if (result.affected && result.affected > 0) {
      console.log(
        `🧹 Limpeza de Jobs: ${result.affected} jobs 'processando' foram marcados como 'interrompido'.`,
      );
    }

    // Re-sincroniza as câmeras ativas no MediaMTX (paths via API são voláteis).
    // Import dinâmico para evitar dependência circular (MediaMtxService importa este DataSource).
    try {
      const { default: MediaMtxService } = await import(
        "../services/MediaMtxService"
      );
      await MediaMtxService.syncAllActive();
    } catch (err) {
      console.error("Falha ao sincronizar câmeras no MediaMTX:", err);
    }

    // Inicia a gravação por movimento (listeners de eventos das câmeras ativas).
    try {
      const { default: CameraIvsService } = await import(
        "../services/CameraIvsService"
      );
      await CameraIvsService.startAll();
    } catch (err) {
      console.error("Falha ao iniciar gravação por movimento:", err);
    }
  })
  .catch((err) => {
    console.error("Error during Data Source initialization", err);
  });

export default AppDataSource;
