import { Router } from "express";
import rateLimit from "express-rate-limit";
import WatchTvConta from "../controller/WatchTvConta";

const router: Router = Router();

// Contra quem tenta adivinhar token ou testar e-mails em massa na Watch.
const limiteCriacao = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente em alguns minutos." },
});

// Abrir a página é mais frequente (recarregar, voltar), então o teto é maior.
const limiteAbertura = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente em alguns minutos." },
});

// Públicas: é o cliente quem abre, pelo link enviado pelo atendimento. A
// autenticação é o token aleatório da URL (com prazo e de uso único), e a
// resposta não traz dado pessoal além do primeiro nome.
router.get("/:token", limiteAbertura, WatchTvConta.abrir);
router.post("/:token", limiteCriacao, WatchTvConta.criar);

export default router;
