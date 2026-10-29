import { Request, Response } from "express";
import {
  criarContaPeloConvite,
  dadosDoConvite,
  ErroConvite,
} from "../services/streamingCadastro";

/**
 * Página pública do link da Watch TV: o cliente escolhe o e-mail e o celular
 * da conta. A autenticação é o próprio token do link (aleatório, com prazo e
 * de uso único).
 */
class WatchTvConta {
  public async abrir(req: Request, res: Response) {
    try {
      res.json(await dadosDoConvite(req.params.token));
    } catch (e: any) {
      responderErro(res, e, "Erro ao abrir o link.");
    }
  }

  public async criar(req: Request, res: Response) {
    try {
      const { email, celular } = req.body as {
        email?: string;
        celular?: string;
      };
      const r = await criarContaPeloConvite({
        token: req.params.token,
        email: email || "",
        phone: celular || "",
      });
      res.json({ ok: true, email: r.email });
    } catch (e: any) {
      responderErro(res, e, "Erro ao criar a conta. Tente novamente.");
    }
  }
}

function responderErro(res: Response, e: any, padrao: string) {
  if (e instanceof ErroConvite) {
    res.status(e.status).json({ message: e.message });
    return;
  }
  console.error("[WatchTvConta]", e);
  res.status(500).json({ message: padrao });
}

export default new WatchTvConta();
