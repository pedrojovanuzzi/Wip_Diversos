# MediaMTX + tzdata para que recordPath use o horário de Brasília.
# A imagem oficial é baseada em scratch (sem banco de fusos), então o Go cai
# para UTC. Aqui copiamos o tzdata de uma imagem Alpine e fixamos o TZ.
# Mesma imagem serve para teste local (Windows) e produção (Linux).
FROM alpine:3 AS tz
RUN apk add --no-cache tzdata

FROM bluenviron/mediamtx:latest
COPY --from=tz /usr/share/zoneinfo /usr/share/zoneinfo
ENV TZ=America/Sao_Paulo
