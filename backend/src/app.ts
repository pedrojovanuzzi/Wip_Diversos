import express from "express";
import cors from "cors";
import cron from "node-cron";

// Routes
import Auth from "./routes/Auth.Routes";
import ChamadosRouter from "./routes/Chamados.Routes";
import SerContratosRoutes from "./routes/SerContratos.Routes";
import StreamingRoutes from "./routes/Streaming.Routes";
import WatchBrasilWebhookRoutes from "./routes/WatchBrasilWebhook.routes";
import Home from "./routes/Home.Routes";
import Feed from "./routes/Feedback.routes";
import NFSE from "./routes/NFSE.routes";
import NFE from "./routes/NFE.Routes";
import NFCom from "./routes/NFCom.routes";
import Whatsapp from "./routes/Whatsapp.Routes";
import WhatsappWebHook from "./routes/WhatsappWebHook.routes";
import Prefeitura from "./routes/PrefeituraUser.routes";
import ClientAnalytics from "./routes/ClientAnalytics.routes";
import ServidorAcessoRoutes from "./routes/ServidorAcesso.routes";
import DosProtect from "./routes/DosProtect.Routes";
import ServerLogs from "./routes/ServerLogs.Routes";
import PowerDNS from "./routes/PowerDns.routes";
import Onu from "./routes/Onu.routes";
import BackupRoutes from "./routes/Backup.routes";
import PixRoutes from "./routes/Pix.routes";
import TokenAtendimentoRoutes from "./routes/TokenAtendimento.routes";
import TimeTrackingRoutes from "./routes/TimeTracking.routes";
import Licenca from "./routes/Licenca.Routes";
import ZapSignRoutes from "./routes/ZapSign.routes";
import ZapSignTemplatesRoutes from "./routes/ZapSignTemplates.routes";
import SolicitacaoServicoRouter from "./routes/SolicitacaoServico.routes";
import ChamadoFichaTecnicaRouter from "./routes/ChamadoFichaTecnica.routes";
import WhatsappTestRoutes from "./routes/WhatsappTest.routes";
import PhoneLocationRoutes from "./routes/PhoneLocation.routes";
import TotemSolicitacaoRoutes from "./routes/TotemSolicitacao.routes";
import Pm2LogsRoutes from "./routes/Pm2Logs.routes";
import CameraRoutes from "./routes/Camera.routes";
import TvWipRoutes from "./routes/TvWip.routes";
import FileShareRoutes from "./routes/FileShare.routes";
import ServiceLinkRoutes from "./routes/ServiceLink.routes";
import CodefRoutes from "./routes/Codef.routes";

// Controllers (for scheduled tasks)
import BackupController from "./controller/Backup";
import PixController from "./controller/Pix";
import pixAutomaticoService from "./services/PixAutomaticoService";
import licencaMensalidadeService from "./services/LicencaMensalidadeService";
// import DosProtectController from "./controller/DosProtect";

const backup = new BackupController();
const pix = new PixController();

export class App {
  public server: express.Application;

  constructor() {
    this.server = express();
    this.middleware();
    this.router();
    this.agendarBackup();
    this.agendarPixAutomatico();
    this.agendarMensalidadesDeLicenca();
    // this.verificaDDOS();
  }

  private middleware() {
    this.server.use(cors());
    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: true }));
  }

  private router() {
    this.server.use("/api/chamados", ChamadosRouter);
    this.server.use("/api/sercontratos", SerContratosRoutes);
    this.server.use("/api/streaming", StreamingRoutes);
    this.server.use("/api/watchbrasil/redirect", WatchBrasilWebhookRoutes);
    this.server.use("/api/", Home);
    this.server.use("/api/auth", Auth);
    this.server.use("/api/feedback", Feed);
    this.server.use("/api/nfse", NFSE);
    this.server.use("/api/NFEletronica", NFE);
    this.server.use("/api/NFCom", NFCom);
    this.server.use("/api/whatsapp", Whatsapp);
    this.server.use("/api/whatsappWebHook", WhatsappWebHook);
    this.server.use("/api/Prefeitura", Prefeitura);
    this.server.use("/api/ClientAnalytics", ClientAnalytics);
    this.server.use("/api/servidores-acesso", ServidorAcessoRoutes);
    this.server.use("/api/DosProtect", DosProtect);
    this.server.use("/api/ServerLogs", ServerLogs);
    this.server.use("/api/PowerDns", PowerDNS);
    this.server.use("/api/Onu", Onu);
    this.server.use("/api/Backup", BackupRoutes);
    this.server.use("/api/Pix", PixRoutes);
    this.server.use("/api/TokenAutoAtendimento", TokenAtendimentoRoutes);
    this.server.use("/api/time-tracking", TimeTrackingRoutes);
    this.server.use("/api/licenca", Licenca);
    this.server.use("/api/zapsign", ZapSignRoutes);
    this.server.use("/api/zapsign-templates", ZapSignTemplatesRoutes);
    this.server.use("/api/solicitacao-servico", SolicitacaoServicoRouter);
    this.server.use("/api/chamados-ficha", ChamadoFichaTecnicaRouter);
    this.server.use("/api/whatsapp-test", WhatsappTestRoutes);
    this.server.use("/api/phone-location", PhoneLocationRoutes);
    this.server.use("/api/totem-solicitacao", TotemSolicitacaoRoutes);
    this.server.use("/api/pm2-logs", Pm2LogsRoutes);
    this.server.use("/api/cameras", CameraRoutes);
    this.server.use("/api/tv-wip", TvWipRoutes);
    this.server.use("/api/files", FileShareRoutes);
    this.server.use("/api/service-links", ServiceLinkRoutes);
    this.server.use("/api/codef", CodefRoutes);
  }

  private agendarBackup() {
    // 🕒 Agendar para todo dia às 03:00
    cron.schedule("0 3 * * *", async () => {
      console.log(
        "⏰ Executando backup automático",
        new Date().toLocaleString(),
      );
      try {
        await backup.gerarTodos();
      } catch (err) {
        console.error("❌ Falha no backup agendado:", err);
      }
    });

    console.log("📅 Agendador de backup inicializado.");
  }

  private agendarPixAutomatico() {
    // 🕒 Cobranças do mês: todo dia 1º às 03:00.
    cron.schedule("0 3 1 * *", async () => {
      console.log("⏰ Executando Pix automático", new Date().toLocaleString());
      try {
        await pixAutomaticoService.garantirCobrancasDoMes();
      } catch (err) {
        console.error("❌ Falha no Pix automático:", err);
      }
    });

    // 🕒 Conferência diária às 04:00: dá baixa no que foi pago mas cuja
    // notificação não chegou (a Efí desiste depois de 9 tentativas e não
    // reenvia webhook de Pix Automático).
    cron.schedule("0 4 * * *", async () => {
      console.log(
        "⏰ Conferindo cobranças do Pix Automático",
        new Date().toLocaleString(),
      );
      try {
        await pixAutomaticoService.processarNotificacoesPendentes();
        await pixAutomaticoService.conciliarPeriodo();
      } catch (err) {
        console.error("❌ Falha na conferência do Pix Automático:", err);
      }
    });

    // 🕒 Recuperação na inicialização: se a máquina estava desligada na hora do
    // agendamento, o mês ficaria sem cobrança nenhuma. Só cria o que falta,
    // então pode rodar a cada restart.
    if (process.env.PIX_AUTOMATICO_DESLIGAR_RECUPERACAO !== "true") {
      setTimeout(() => {
        pixAutomaticoService
          .garantirCobrancasDoMes()
          .then(() => pixAutomaticoService.processarNotificacoesPendentes())
          .catch((err) =>
            console.error("❌ Falha na recuperação do Pix Automático:", err),
          );
      }, 60_000);
    }

    console.log("📅 Agendador de Pix");
  }

  /**
   * Mensalidades das licenças de software.
   *
   * Roda todo dia às 03:15 em vez de só no dia 1º: a rotina não duplica
   * (mensalidade é única por licença e mês), então uma licença cadastrada no
   * meio do mês já entra na cobrança sem esperar o mês seguinte, e um dia com
   * o servidor desligado não deixa o mês em branco.
   */
  private agendarMensalidadesDeLicenca() {
    cron.schedule("15 3 * * *", async () => {
      try {
        await licencaMensalidadeService.gerarMensalidades();
      } catch (err) {
        console.error("❌ Falha ao gerar mensalidades de licença:", err);
      }
    });

    console.log("📅 Agendador de mensalidades de licença");
  }

  // private verificaDDOS(){
  //   console.log('Verificando DDDOS');
  //
  //   cron.schedule("* * * * *", async () => {
  //     try {
  //       await new DosProtectController().startFunctions();
  //     } catch (err) {
  //       console.error("❌ Falha no backup agendado:", err);
  //     }
  //   });
  //
  //   console.log("📅 Agendador de backup inicializado.");
  // }
}
