import { verify, index } from "./handlers/webhook.handler";
import { Flow } from "./handlers/flow.handler";
import { whatsappIncomingQueue, whatsappOutgoingQueue } from "./services/messaging.service";

// Inicializa os workers ao importar este módulo
import "./queues";

// Objeto compatível com a interface anterior (WhatsConversationPath default export)
const whatsPixController = {
  index,
  verify,
  Flow,
};

export { whatsappIncomingQueue, whatsappOutgoingQueue };
export default whatsPixController;
