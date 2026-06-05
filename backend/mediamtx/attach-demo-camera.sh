#!/bin/bash
###############################################################################
# attach-demo-camera.sh — Atrela uma câmera de teste a um cliente e a deixa
# gravando continuamente, para testar a aba "Pasta" do portal.
#
# Publica um stream de teste (testsrc, igual ao loadtest) num feed local e
# cadastra uma câmera no cliente apontando para esse feed. O MediaMTX puxa o
# feed e grava em /recordings/<path> — que aparece na aba Pasta.
#
# Uso:
#   ./attach-demo-camera.sh <LOGIN> <SENHA>
#   ./attach-demo-camera.sh PEDROJOVANUZZI minhasenha123
#
# Requisitos: ffmpeg, curl, python3, MediaMTX e backend rodando.
###############################################################################

set -euo pipefail

LOGIN="${1:-}"
PASSWORD="${2:-}"

API_MTX="http://localhost:9997"
API_BACK="http://localhost:3000/api/cameras"
RTSP="rtsp://localhost:8554"
FEED="demo_feed"

if [ -z "$LOGIN" ] || [ -z "$PASSWORD" ]; then
  echo "Uso: $0 <LOGIN> <SENHA>"
  echo "Ex:  $0 PEDROJOVANUZZI minhasenha"
  exit 1
fi

command -v ffmpeg >/dev/null || { echo "❌ ffmpeg não instalado (apt install ffmpeg)"; exit 1; }
command -v python3 >/dev/null || { echo "❌ python3 não instalado"; exit 1; }

echo "🎥 1/4 — criando o feed de teste no MediaMTX (sem gravar o feed em si)..."
curl -s -X POST "$API_MTX/v3/config/paths/add/$FEED" \
  -H "Content-Type: application/json" -d '{"record": false}' > /dev/null || true

echo "▶️  2/4 — publicando testsrc no feed (persistente)..."
# Mata um feed anterior se existir e sobe um novo em background.
pkill -f "rtsp://localhost:8554/$FEED" 2>/dev/null || true
nohup ffmpeg -nostdin -re -f lavfi -i "testsrc=size=1280x720:rate=15" \
  -vf format=yuv420p -c:v libx264 -preset ultrafast -tune zerolatency -g 30 \
  -f rtsp "$RTSP/$FEED" -loglevel error </dev/null >/tmp/demo_feed.log 2>&1 &
echo "   feed publicando (pid $!) — log em /tmp/demo_feed.log"
sleep 4

echo "🔑 3/4 — autenticando como $LOGIN..."
TOKEN=$(curl -s -X POST "$API_BACK/login" -H "Content-Type: application/json" \
  -d "{\"login\":\"$LOGIN\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Falha no login. Confira login/senha (e se a conta está ativa)."
  exit 1
fi

echo "📷 4/4 — cadastrando a câmera de teste no cliente..."
RESP=$(curl -s -X POST "$API_BACK/cameras" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"nome\":\"Câmera Demo (teste)\",\"rtsp_url\":\"$RTSP/$FEED\"}")
echo "   resposta: $RESP"

echo ""
echo "✅ Pronto! A câmera 'Câmera Demo (teste)' foi atrelada a $LOGIN e está gravando."
echo "   Entre no portal com $LOGIN → abra a câmera → aba 'Pasta'."
echo "   Obs.: cada segmento gravado tem ~1h (recordSegmentDuration), mas o arquivo"
echo "   aparece na pasta assim que começa a gravar (vai crescendo)."
echo ""
echo "Para parar o feed de teste depois:"
echo "   pkill -f 'rtsp://localhost:8554/$FEED'"
