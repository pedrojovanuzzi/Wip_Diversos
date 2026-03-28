import { verify, index } from "./handlers/webhook.handler";
import { Flow } from "./handlers/flow.handler";
import { whatsappIncomingQueue, whatsappOutgoingQueue } from "./services/messaging.service";

// Objeto compatível com a interface anterior (WhatsConversationPath default export)
const whatsPixController = {
  index,
  verify,
  Flow,
};

export { whatsappIncomingQueue, whatsappOutgoingQueue };
export { initQueues } from "./queues";
export default whatsPixController;
