import "reflect-metadata";

import { App } from "./app"
import { initQueues } from "./controller/whatsapp/index";
import { ensureOllamaModel } from "./services/OllamaService";

const app = new App();
app.server.listen(3000, () => {
  initQueues();
  ensureOllamaModel();
});