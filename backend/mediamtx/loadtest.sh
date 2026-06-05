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
RECORDINGS_DIR="/var/lib/docker/volumes/backend_mediamtx_recordings/_data"

# Parâmetros do stream de teste
SIZE="640x480"
FPS="25"

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

  # 1. Cria os paths via API
  for i in $(seq 1 "$n"); do
    curl -s -X POST "$API/v3/config/paths/add/${PREFIX}${i}" \
      -H "Content-Type: application/json" -d '{}' > /dev/null
  done
  echo "   ✔ $n paths criados na API"

  # 2. Sobe os ffmpeg (com -nostdin pra não suspender em background)
  : > "$PIDFILE"
  for i in $(seq 1 "$n"); do
    ffmpeg -nostdin -re -f lavfi -i "testsrc=size=${SIZE}:rate=${FPS}" \
      -vf format=yuv420p -c:v libx264 -preset ultrafast -tune zerolatency \
      -f rtsp "${RTSP}/${PREFIX}${i}" -loglevel quiet </dev/null &
    echo $! >> "$PIDFILE"
  done
  echo "   ✔ $n streams ffmpeg iniciados"

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
  echo "Disco das gravações:"
  df -h "$RECORDINGS_DIR" 2>/dev/null | sed 's/^/  /' || df -h / | sed 's/^/  /'
}

stop() {
  echo "🛑 Parando teste..."
  pkill -f "ffmpeg -nostdin -re -f lavfi" 2>/dev/null || true
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
  echo "🧹 Apagando gravações de teste..."
  rm -rf "${RECORDINGS_DIR}/${PREFIX}"* 2>/dev/null || true
  echo "   ✔ gravações de teste removidas"
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
