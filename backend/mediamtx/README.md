# Portal de Câmeras — MediaMTX

O streaming RTSP, a visualização ao vivo (WebRTC) e a gravação 24/7 são feitos pelo
**MediaMTX**, rodando em um container separado. O backend Node **não processa vídeo** —
ele apenas orquestra o MediaMTX pela API HTTP e emite tokens curtos de acesso.

## Como subir

1. Ajuste `mediamtx.yml`:
   - `authHTTPAddress` deve apontar para o backend (`http://backend:PORTA/api/cameras/mediamtx-auth`).
   - `recordDeleteAfter` controla a retenção (padrão `72h` = 3 dias).
   - Em produção, exponha a porta WebRTC (8889) atrás de HTTPS/reverse proxy.
2. Suba o serviço (veja `docker-compose.example.yml`), na **mesma rede Docker** do backend.
3. Confirme a API: `curl http://localhost:9997/v3/config/global/get`.

## Variáveis de ambiente do backend (.env)

```env
# API de controle do MediaMTX (rede interna)
MEDIAMTX_API_URL=http://mediamtx:9997

# Base pública WHEP (WebRTC) acessível pelo navegador do cliente
MEDIAMTX_WEBRTC_PUBLIC=https://cam.seudominio.com

# Base pública do playback server (gravações), porta 9996
MEDIAMTX_PLAYBACK_PUBLIC=https://cam.seudominio.com/playback

# Retenção das gravações (deve casar com recordDeleteAfter do mediamtx.yml)
MEDIAMTX_RECORD_DELETE_AFTER=72h
```

> `MEDIAMTX_WEBRTC_PUBLIC` e `MEDIAMTX_PLAYBACK_PUBLIC` devem ser URLs que **o navegador
> do cliente** consegue acessar (não o hostname interno do Docker). Em desenvolvimento,
> use `http://localhost:8889` e `http://localhost:9996`.

## Fluxo de autenticação do vídeo

1. O cliente logado pede `GET /api/cameras/cameras/:id/stream`.
2. O backend emite um **token curto (60s)** atrelado ao `path` daquela câmera e retorna a
   URL WHEP com `?token=...`.
3. O navegador conecta no MediaMTX (WHEP); o MediaMTX chama
   `/api/cameras/mediamtx-auth` no backend, que valida o token e o path.
4. Só é liberado se o token for válido **e** o path pertencer ao cliente — isolando o
   acesso por conta.

## Persistência dos paths

Paths adicionados via API são voláteis (memória). O **banco é a fonte da verdade**: ao
iniciar, o backend chama `MediaMtxService.syncAllActive()` e recria os paths das câmeras
ativas no MediaMTX.
