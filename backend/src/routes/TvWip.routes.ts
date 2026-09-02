import { Router, Request, Response, NextFunction } from "express";
import TvWip from "../controller/TvWip";
import AuthGuard from "../middleware/AuthGuard";
import multer from "multer";

/**
 * A logo fica em memória: ela é repassada ao servidor do TV_WIP2 e não precisa
 * tocar o disco desta máquina. 4 MB é folga larga para uma logo de canal.
 */
const logo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Envie um arquivo de imagem."));
  },
});

const router: Router = Router();

/**
 * A rota de autenticação é consumida pelo APLICATIVO da TV, que não tem login
 * no painel — por isso não passa pelo AuthGuard. Em troca exige uma chave
 * fixa: sem ela, qualquer um poderia testar login e senha dos clientes à
 * vontade contra este endpoint.
 */
function ChaveDoApp(req: Request, res: Response, next: NextFunction) {
  const esperada = process.env.TV_WIP_API_KEY;

  if (!esperada) {
    console.error(
      "[TvWip] TV_WIP_API_KEY não configurada: a rota de autenticação está " +
        "recusando tudo até a chave ser definida no .env.",
    );
    res.status(503).json({
      permitido: false,
      motivo: "NAO_CONFIGURADO",
      mensagem: "Serviço de autenticação indisponível.",
    });
    return;
  }

  const recebida =
    req.header("x-api-key") ||
    req.header("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (recebida !== esperada) {
    res.status(401).json({
      permitido: false,
      motivo: "CHAVE_INVALIDA",
      mensagem: "Chave de aplicativo inválida.",
    });
    return;
  }

  next();
}

// ---- Aplicativo da TV ----
router.post("/auth", ChaveDoApp, TvWip.autenticar);

// ---- Painel interno ----
router.get("/", AuthGuard, TvWip.listar);
router.post("/avulso", AuthGuard, TvWip.criarAvulso);
router.delete("/avulso/:login", AuthGuard, TvWip.removerAvulso);
router.post("/desativar", AuthGuard, TvWip.desativar);
router.post("/reativar", AuthGuard, TvWip.reativar);
router.post("/sincronizar", AuthGuard, TvWip.sincronizar);

// ---- Canais e pacotes ----
router.get("/canais", AuthGuard, TvWip.listarCanais);
router.post("/canais", AuthGuard, logo.any(), TvWip.criarCanal);
router.post("/canais/:idcanal/logo", AuthGuard, logo.any(), TvWip.enviarLogo);
router.delete("/canais/:idcanal", AuthGuard, TvWip.removerCanal);
router.put("/canais/:idcanal", AuthGuard, TvWip.salvarCanal);
router.get("/pacotes", AuthGuard, TvWip.listarPacotes);
router.post("/pacotes", AuthGuard, TvWip.salvarPacote);
router.delete("/pacotes/:id", AuthGuard, TvWip.removerPacote);
router.post("/pacotes/atribuir", AuthGuard, TvWip.atribuirPacotes);
router.get("/conta/:login", AuthGuard, TvWip.detalhesDaConta);
router.post("/conta/:login/excecao", AuthGuard, TvWip.definirExcecao);

export default router;
