import "reflect-metadata";

import { App } from "./app"
import { initQueues } from "./controller/whatsapp/index";
import ClientMonitorService from "./services/ClientMonitorService";
import StreamingTesteService from "./services/StreamingTesteService";

// Handler async de rota que rejeita derruba o processo inteiro no Node >= 15
// (unhandled rejection = throw). Um erro de API externa não pode tirar o
// backend do ar: registramos e seguimos.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Promise rejeitada sem tratamento:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException] Exceção não tratada:", error);
});

const app = new App();
app.server.listen(3000, () => {
  initQueues();
  // Retoma os monitoramentos de clientes que ficaram ativos antes do restart.
  ClientMonitorService.start().catch((error) =>
    console.error("[ClientMonitorService] Falha ao iniciar:", error),
  );
  // Encerra as assinaturas de teste da Watch TV quando o prazo vence.
  StreamingTesteService.start();
});