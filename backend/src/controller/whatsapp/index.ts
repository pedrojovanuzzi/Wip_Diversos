import { verify, index } from "./handlers/webhook.handler";
import { Flow } from "./handlers/flow.handler";
import {
  whatsappIncomingQueue,
  whatsappOutgoingQueue,
} from "./services/messaging.service";

const whatsPixController = {
  index,
  verify,
  Flow,
};

export { whatsappIncomingQueue, whatsappOutgoingQueue };
export { MensagensComuns, enviarNotificacaoServico } from "./services/messaging.service";
export { gerarLancamentoServico } from "./services/payment.service";
export { initQueues } from "./queues";
export default whatsPixController;
