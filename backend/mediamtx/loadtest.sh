#!/bin/bash
###############################################################################
# loadtest.sh — Teste de carga do MediaMTX simulando N câmeras RTSP.
#
# Cada "câmera" é um ffmpeg publicando um stream de teste (testsrc) no MediaMTX.
# Os paths são criados via API antes de publicar e removidos no stop/clean.
# As gravações de teste vão pra /recordings/test_cam_* (apagadas no clean).
#
# Uso:
#   ./loadtest.sh start [N]   # sobe N câmeras (padrão 50)
#   ./loadtest.sh status      # mostra quantos paths estão ONLINE + CPU/RAM
#   ./loadtest.sh stop        # mata os ffmpeg e remove os paths de teste
#   ./loadtest.sh clean       # stop + apaga as gravações de teste do disco
#
# Requisitos: ffmpeg, curl, python3 (e o MediaMTX rodando).
###############################################################################

set -euo pipefail

API="http://localhost:9997"
RTSP="rtsp://localhost:8554"
PREFIX="test_cam_"
PIDFILE="/tmp/mediamtx_loadtest.pids"

# Lê variáveis do .env do backend SEM sourcing (sourcing executaria valores com
# espaços/aspas/# e quebraria — ex.: "VAR=texto de coisa"). Lemos só as chaves
# que este script usa, tirando aspas externas.
ENV_FILE="$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)/.env"
read_env() {
  local key="$1" line
  [ -f "$ENV_FILE" ] || return 0
  line=$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1) || return 0
  line="${line#*=}"                      # remove "KEY="
  line="${line%\"}"; line="${line#\"}"   # aspas duplas externas
  line="${line%\'}"; line="${line#\'}"   # aspas simples externas
  printf '%s' "$line"
}

# Env já exportada no shell tem prioridade; senão lê do .env.
MEDIAMTX_RECORDINGS_PATH="${MEDIAMTX_RECORDINGS_PATH:-$(read_env MEDIAMTX_RECORDINGS_PATH)}"
CAMERA_STORAGE_HOST="${CAMERA_STORAGE_HOST:-$(read_env CAMERA_STORAGE_HOST)}"
CAMERA_STORAGE_PORT="${CAMERA_STORAGE_PORT:-$(read_env CAMERA_STORAGE_PORT)}"
CAMERA_STORAGE_USER="${CAMERA_STORAGE_USER:-$(read_env CAMERA_STORAGE_USER)}"
CAMERA_STORAGE_PASSWORD="${CAMERA_STORAGE_PASSWORD:-$(read_env CAMERA_STORAGE_PASSWORD)}"
CAMERA_STORAGE_PATH="${CAMERA_STORAGE_PATH:-$(read_env CAMERA_STORAGE_PATH)}"

# Pasta onde o MediaMTX grava (staging). Respeita a env do backend; fallback pro
# bind mount atual (backend/storage/recordings), não mais o volume Docker antigo.
RECORDINGS_DIR="${MEDIAMTX_RECORDINGS_PATH:-$(cd "$(dirname "$0")/../storage/recordings" 2>/dev/null && pwd)}"
RECORDINGS_DIR="${RECORDINGS_DIR:-./storage/recordings}"

# Storage remoto: quando CAMERA_STORAGE_HOST está setado, o offload envia cada
# segmento finalizado por SFTP e o apaga do disco local (staging). Logo, o disco
# "real" do teste está no servidor remoto, não localmente.
remote_enabled() { [ -n "${CAMERA_STORAGE_HOST:-}" ]; }

# Parâmetros do stream de teste
SIZE="640x480"
FPS="25"
# Arquivo-fonte gerado UMA vez e republicado com -c copy (sem reencode). Assim
# cada "câmera" só REMUXA (custo ~zero de CPU) em vez de codificar x264, evitando
# que o GERADOR sature a CPU e mascare a capacidade real do MediaMTX.
SRCFILE="/tmp/mediamtx_loadtest_src.mp4"
SRC_SECONDS="10"

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ '$1' não encontrado. Instale antes."; exit 1; }
}

count_online() {
  curl -s "$API/v3/paths/list" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = [p for p in d['items'] if p['name'].startswith('$PREFIX')]
    online = sum(1 for p in items if p.get('ready'))
    print(f'{online} ONLINE de {len(items)} câmeras de teste')
except Exception as e:
    print('Erro ao ler API:', e)
"
}

start() {
  local n="${1:-50}"
  require ffmpeg
  require curl               
  require python3

  echo "🎬 Iniciando $n câmeras de teste..."

  # 0. Garante baseline limpo: mata qualquer ffmpeg residual de testes anteriores.
  if pgrep ffmpeg > /dev/null; then
    echo "   ⚠ ffmpeg residual encontrado — limpando antes de começar."
    pkill -9 ffmpeg 2>/dev/null || true
    sleep 2
  fi

  # 1. Cria os paths via API
  for i in $(seq 1 "$n"); do
    curl -s -X POST "$API/v3/config/paths/add/${PREFIX}${i}" \
      -H "Content-Type: application/json" -d '{}' > /dev/null
  done
  echo "   ✔ $n paths criados na API"

  # 1b. Gera o arquivo-fonte UMA vez (codifica x264 só agora, não por câmera).
  # Keyframe a cada segundo (-g $FPS) para o loop emendar limpo.
  if [ ! -f "$SRCFILE" ]; then
    echo "   ⏺ Gerando arquivo-fonte de teste (${SRC_SECONDS}s, ${SIZE}@${FPS})..."
    ffmpeg -nostdin -y -f lavfi -i "testsrc=size=${SIZE}:rate=${FPS}" \
      -t "$SRC_SECONDS" -c:v libx264 -preset ultrafast -tune zerolatency \
      -pix_fmt yuv420p -g "$FPS" "$SRCFILE" -loglevel error </dev/null
  fi

  # 2. Sobe os ffmpeg republicando o arquivo em loop com -c copy (só remuxa,
  # CPU ~zero). -nostdin pra não suspender em background.
  : > "$PIDFILE"
  for i in $(seq 1 "$n"); do
    ffmpeg -nostdin -re -stream_loop -1 -i "$SRCFILE" \
      -c copy -f rtsp "${RTSP}/${PREFIX}${i}" -loglevel quiet </dev/null &
    echo $! >> "$PIDFILE"
  done
  echo "   ✔ $n streams ffmpeg iniciados (remux, sem reencode)"

  echo "⏳ Aguardando estabilizar..."
  sleep 6
  count_online
  echo ""
  echo "👉 Monitore com:  ./loadtest.sh status   (ou htop)"
  echo "👉 Para parar:    ./loadtest.sh stop"
}

status() {
  count_online
  echo ""
  echo "=== Recursos do servidor ==="
  # CPU/RAM resumido
  echo "CPU/MEM (top 1 amostra):"
  top -bn1 | grep "Cpu(s)" | sed 's/^/  /'
  free -h | sed 's/^/  /'
  echo ""
  echo "Processos ffmpeg ativos: $(pgrep -c ffmpeg || echo 0)"
  echo "Disco do staging local ($RECORDINGS_DIR):"
  df -h "$RECORDINGS_DIR" 2>/dev/null | sed 's/^/  /' || df -h / | sed 's/^/  /'

  if remote_enabled; then
    echo ""
    echo "⚠ Storage remoto ATIVO (CAMERA_STORAGE_HOST=$CAMERA_STORAGE_HOST):"
    echo "  as gravações de teste são enviadas por SFTP e apagadas do disco local."
    if command -v sshpass >/dev/null 2>&1 && [ -n "${CAMERA_STORAGE_PASSWORD:-}" ]; then
      echo "  Uso das câmeras de teste no remoto:"
      sshpass -p "$CAMERA_STORAGE_PASSWORD" ssh -o StrictHostKeyChecking=no \
        -p "${CAMERA_STORAGE_PORT:-22}" \
        "${CAMERA_STORAGE_USER}@${CAMERA_STORAGE_HOST}" \
        "du -sh ${CAMERA_STORAGE_PATH%/}/${PREFIX}* 2>/dev/null | tail -n 20" \
        2>/dev/null | sed 's/^/    /' || echo "    (não foi possível consultar o remoto)"
    else
      echo "  (instale 'sshpass' e defina CAMERA_STORAGE_PASSWORD p/ ver o uso remoto)"
    fi
  fi
}

stop() {
  echo "🛑 Parando teste..."
  # No servidor de produção, NENHUM ffmpeg é legítimo (o MediaMTX puxa RTSP
  # nativamente, sem ffmpeg). Então matamos todos para não acumular zumbis.
  pkill -9 ffmpeg 2>/dev/null || true
  rm -f "$PIDFILE"

  # Remove os paths de teste da API
  local items
  items=$(curl -s "$API/v3/config/paths/list" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for p in d['items']:
        if p['name'].startswith('$PREFIX'):
            print(p['name'])
except Exception:
    pass
" || true)

  for name in $items; do
    curl -s -X DELETE "$API/v3/config/paths/delete/${name}" > /dev/null || true
  done
  echo "   ✔ ffmpeg encerrados e paths de teste removidos"
}

clean() {
  stop
  echo "🧹 Apagando gravações de teste (staging local)..."
  rm -rf "${RECORDINGS_DIR}/${PREFIX}"* 2>/dev/null || true
  echo "   ✔ gravações de teste locais removidas"

  if remote_enabled; then
    echo "🧹 Apagando gravações de teste no servidor remoto..."
    if command -v sshpass >/dev/null 2>&1 && [ -n "${CAMERA_STORAGE_PASSWORD:-}" ]; then
      sshpass -p "$CAMERA_STORAGE_PASSWORD" ssh -o StrictHostKeyChecking=no \
        -p "${CAMERA_STORAGE_PORT:-22}" \
        "${CAMERA_STORAGE_USER}@${CAMERA_STORAGE_HOST}" \
        "rm -rf ${CAMERA_STORAGE_PATH%/}/${PREFIX}*" 2>/dev/null \
        && echo "   ✔ gravações de teste removidas do remoto" \
        || echo "   ⚠ falha ao limpar o remoto (apague manualmente ${CAMERA_STORAGE_PATH%/}/${PREFIX}*)"
    else
      echo "   ⚠ 'sshpass'/CAMERA_STORAGE_PASSWORD ausentes — apague manualmente:"
      echo "     ${CAMERA_STORAGE_PATH%/}/${PREFIX}* em ${CAMERA_STORAGE_HOST}"
    fi
  fi
}

case "${1:-}" in
  start)  start "${2:-50}" ;;
  status) status ;;
  stop)   stop ;;
  clean)  clean ;;
  *)
    echo "Uso: $0 {start [N] | status | stop | clean}"
    echo "  start [N]  sobe N câmeras de teste (padrão 50)"
    echo "  status     mostra ONLINE + CPU/RAM/disco"
    echo "  stop       para os ffmpeg e remove os paths de teste"
    echo "  clean      stop + apaga as gravações de teste"
    exit 1
    ;;
esac
