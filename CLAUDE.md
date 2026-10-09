# Wip Diversos

## Mapa da fábrica (`docs/fabrica.html`)

`docs/fabrica.html` é um mapa interativo do repositório inteiro: telas do
React, do Next e do app de localização, a portaria (guards), as 38 rotas do
backend agrupadas por bairro, filas e jobs, bancos, serviços externos e
ferramentas. Pedidos de exemplo (login, WhatsApp, NFS-e, Pix, localização,
backup, portaria) andam por "esteiras" até o fim. Também está publicado como
artifact em https://claude.ai/artifact/QUUvHKw2PJg1m2XSrWChgS

**Sempre que criar, renomear ou remover algo no repositório, atualize o mapa
na mesma tarefa.** Isso vale para tela/página (React ou Next), rota,
controller, service, middleware, fila BullMQ, agendamento cron, serviço
iniciado no `server.ts`, DataSource, integração externa ou script/ferramenta
nova. Depois de editar, republique o artifact na mesma URL (Artifact com `url`
acima), para o link continuar valendo.

Onde mexer, dentro do `<script>` do arquivo (seção DADOS):

- **`SCREENS`**: uma linha por pasta de `frontend/app/src/pages`:
  `[pasta, nome, "caminho:nível ..." (nível do App.tsx ou pub), "ids das rotas que chama"]`.
  A posição é calculada pela ordem (grade de 4 colunas).
- **Telas Next** (`n_*`): lista logo abaixo. Quando uma página migrar para o
  Next, inclua a pasta na máquina certa ou crie outra.
- **`CTRLS`**: uma linha por arquivo de `backend/src/routes`:
  `[id, bairro, prefixo, nome, arquivo de rota, controllers, linhas, endpoints, portaria, bancos, externos, descrição]`.
  O bairro (`DIST`: equipe, fiscal, finan, atend, tv, rede) define a posição.
  Bairro com máquina nova pode precisar de placa maior em `PLATES`.
- **Bancos, saídas (`out_*`), segundo plano e ferramentas (`t_*`)**: blocos
  `add(...)` e listas próprias. `links` liga máquinas que não são rota.
- **Pedidos automáticos**: cada linha de `CTRLS` já vira um pedido sozinha
  (`autoMission`), usando a portaria, os bancos e os externos da linha. Rota
  com pedido guiado entra em `GUIDED_FOR`; o que roda ao clicar numa máquina
  que não é rota nem tela fica em `CLICK_MISSION`.
- **`MISSIONS`**: os pedidos guiados, passo a passo (`S(máquina, título, explicação,
  arquivo, linha)`). Se a mudança altera o caminho de um pedido, ajuste.
- **Números citados no texto**: 38 rotas, 34 pastas de tela, 89 migrações,
  horários do cron, linhas/endpoints de cada rota e o tamanho dos
  controllers gigantes na trilha de estudo.
- **Números de linha**: os links apontam para `main` no GitHub com `#L<linha>`
  (0 = arquivo sem linha). Caminhos sem prefixo são relativos a `backend/src/`.
  Se a edição deslocar uma função citada, corrija o número.

Também são calculados sozinhos, a partir dos dados: os contadores do
cabeçalho, a legenda dos tipos de máquina, a lista "Escolher pedido" (guiados
e uma entrada por rota, com os totais de cada bairro), o selo de nível (PÚB/AUTH/N1/N2/N5, tirado da portaria da rota ou
dos níveis da tela), a barra de tamanho do controller e o minimapa. Os
textos fixos da trilha de estudo e do glossário continuam manuais.

As esteiras são desenhadas sozinhas a partir de `apis`, `dbs`, `ext`, `links`
e dos passos dos pedidos. Ao mexer em posições fixas, não sobreponha máquinas
nem placas. No fim, rode `node --check` no conteúdo do `<script>`.
