import "reflect-metadata";

import { App } from "./app"
import { initQueues } from "./controller/whatsapp";

const app = new App();
app.server.listen(3000, () => {
  initQueues();
});