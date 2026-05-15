import { Request, Response, Router } from "express";
import {
  deliverAuthCode,
  exchangeCodeForToken,
} from "../services/WatchBrasilService";

const router: Router = Router();

function pickCode(req: Request): string {
  const q: any = req.query || {};
  const b: any = req.body || {};
  return (
    q.code ||
    q.authorization_code ||
    q.auth_code ||
    q.token ||
    q.access_token ||
    b.code ||
    b.authorization_code ||
    b.auth_code ||
    b.token ||
    b.access_token ||
    ""
  );
}

async function handleRedirect(req: Request, res: Response) {
  console.log("[WatchBrasil][redirect] hit:", {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    headers: {
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
      referer: req.headers.referer,
    },
  });

  const code = pickCode(req);
  const error =
    (req.query.error as string) || (req.body && (req.body.error as string)) || "";
  const state =
    (req.query.state as string) || (req.body && (req.body.state as string)) || "";

  if (error) {
    console.error("[WatchBrasil][redirect] erro do provedor:", error);
    res.status(400).json({ ok: false, error, state });
    return;
  }

  if (!code) {
    console.warn("[WatchBrasil][redirect] sem code reconhecido");
    res.status(200).json({
      ok: false,
      message: "code ausente",
      received: { query: req.query, body: req.body },
    });
    return;
  }

  const delivered = deliverAuthCode(code);
  if (delivered) {
    console.log("[WatchBrasil][redirect] code entregue ao authenticate() pendente");
    res.json({ ok: true, state, delivered: true });
    return;
  }

  try {
    await exchangeCodeForToken(code);
    console.log("[WatchBrasil][redirect] token obtido via code (sem pending)");
    res.json({ ok: true, state, delivered: false });
  } catch (e: any) {
    console.error(
      "[WatchBrasil][redirect] falha ao trocar code por token:",
      e?.response?.data || e?.message || e,
    );
    res.status(502).json({
      ok: false,
      message: "Falha ao trocar code por token",
      detail: e?.response?.data || e?.message || String(e),
    });
  }
}

router.get("/", handleRedirect);
router.post("/", handleRedirect);

export default router;
