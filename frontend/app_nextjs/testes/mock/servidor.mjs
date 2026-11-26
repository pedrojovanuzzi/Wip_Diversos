#!/usr/bin/env node
/**
 * Backend de mentira para os testes das páginas. Responde em /api/... com as
 * respostas de ./respostas.mjs e anota toda rota que não conhece.
 *
 *   node testes/mock/servidor.mjs            (porta 4010)
 *   GET  /__mock/sem-resposta                lista as rotas pedidas sem mock
 *                                            e os pedidos inválidos (corpo errado)
 *   POST /__mock/limpar                      zera essa lista
 */
import http from "node:http";
import { RESPOSTAS } from "./respostas.mjs";

const PORTA = Number(process.env.MOCK_PORT || 4010);
const semResposta = new Map(); // "GET /rota" -> quantas vezes

function achar(metodo, caminho) {
  return RESPOSTAS.find(
    ([m, c]) => m === metodo && (typeof c === "string" ? c === caminho : c.test(caminho)),
  );
}

function enviar(res, status, json) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(json));
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORTA}`);
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", async () => {
    if (req.method === "OPTIONS") return enviar(res, 204, {});

    if (url.pathname === "/__mock/sem-resposta") {
      return enviar(res, 200, [...semResposta.entries()].map(([rota, vezes]) => ({ rota, vezes })));
    }
    if (url.pathname === "/__mock/limpar") {
      semResposta.clear();
      return enviar(res, 200, { ok: true });
    }

    const caminho = url.pathname.replace(/^\/api/, "");
    const achada = achar(req.method, caminho);
    if (!achada) {
      const chave = `${req.method} ${caminho}`;
      semResposta.set(chave, (semResposta.get(chave) || 0) + 1);
      return enviar(res, 404, { message: `rota sem mock: ${chave}` });
    }

    let resposta = achada[2];
    if (typeof resposta === "function") {
      let json;
      try {
        json = corpo ? JSON.parse(corpo) : undefined;
      } catch {
        json = undefined;
      }
      resposta = await resposta(req, json, url);
    }
    if (resposta && typeof resposta === "object" && "invalido" in resposta) {
      // A rota existe, mas a tela mandou o pedido errado: conta como problema.
      const chave = `${req.method} ${caminho} → pedido inválido: ${resposta.invalido}`;
      semResposta.set(chave, (semResposta.get(chave) || 0) + 1);
      return enviar(res, 400, { message: resposta.invalido });
    }
    if (resposta && typeof resposta === "object" && "status" in resposta && "json" in resposta) {
      return enviar(res, resposta.status, resposta.json);
    }
    enviar(res, 200, resposta);
  });
});

servidor.listen(PORTA, () => console.log(`mock do backend em http://localhost:${PORTA}/api`));
