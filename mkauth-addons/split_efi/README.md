# Addon SPLIT EFI (MK-Auth)

Registra os boletos na Efí já com o **split de pagamento**: um percentual fixo de cada
boleto vai direto para a conta Efí de um parceiro (`payee_code`), e o restante fica na
conta Efí da Wip.

## Por que um addon emite o boleto

O MK-Auth registra o boleto na Efí pelo código interno dele (criptografado), e não manda
repasse. Na Efí, o split só pode ser enviado no momento em que a cobrança é criada
(`items[].marketplace.repasses`). Por isso o addon:

1. Cria no `sis_boleto` uma conta **"EFI SPLIT (ADDON)"**, que é uma cópia da conta Efí de
   origem com `gateway='fat'`, `utilizar='fatura'` e `calc_boleto='nao'`. Com isso, o
   MK-Auth gera os títulos dessa conta mas não registra em banco nenhum.
2. Move para essa conta todos os clientes da conta de origem (`sis_cliente.conta`) e
   guarda a conta anterior de cada um em `addon_split_clientes`. Cliente cadastrado depois
   na conta de origem também é movido pelo cron.
3. De 5 em 5 minutos, o cron registra cada título novo dessa conta com
   `POST /v1/charge/one-step`. A chamada leva o repasse, a multa e os juros da conta de
   origem e `custom_id = mk:<id do título>`. Depois o addon preenche `chave_gnet2`
   (charge_id), `linhadig` (barcode) e `url` (link do boleto), como o MK-Auth faz.
4. Acompanha os títulos já registrados:
   - apagado, ou pago por outro meio (Pix, caixa): cancela na Efí;
   - mudou de valor: cancela e registra de novo;
   - mudou de vencimento: atualiza na Efí.
5. Quando a Efí avisa o pagamento em `retorno.php`, o addon consulta
   `GET /v1/notification/:token` e dá baixa do mesmo jeito da baixa nativa:
   `formapag='gerencianet'` e lançamento no `sis_caixa`
   "Pagamento do titulo N com EfiPay". A única diferença é o `coletor`, que fica
   `'addon.split'`.

**Desativar** devolve cada cliente à conta anterior. O que já foi registrado na Efí
continua valendo, e o retorno continua dando baixa nesses títulos.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.php` | Tela no painel (menu Provedor > Split Efi). Exige login do MK-Auth via `addons.class.php`. |
| `lib.php` | Funções: banco, API de Cobranças da Efí, ativar/desativar, registro, baixa. Bloqueado na web. |
| `cron.php` | Rodada do agendamento (`/etc/cron.d/split_efi`, a cada 5 min). Só roda em CLI. |
| `retorno.php` | Aviso de pagamento da Efí. Público, mas exige o token aleatório na URL e confere tudo na API da Efí. |
| `install.sh` | Instala no servidor: copia os arquivos e o `addons.class.php`, põe o item no menu, cria o cron e as tabelas. |

Tabelas criadas no `mkradius`: `addon_split_config`, `addon_split_clientes`,
`addon_split_titulos` e `addon_split_log`.

## Instalar

No servidor do MK-Auth, como root:

```sh
cd /caminho/para/split_efi && sh install.sh
```

Depois, no painel, abra **Provedor > Split Efi**:

1. Escolha a conta Efí de origem (a que tem `gateway = gnet`). As credenciais vêm dela:
   *Client ID/Secret* de produção, ou os campos "teste" para homologação.
2. Preencha o ambiente, o `payee_code` do parceiro, o percentual e o endereço público do
   MK-Auth (a Efí precisa conseguir chegar em `retorno.php`).
3. Clique em **Testar credencial** e depois em **Ativar**.

## Pré-requisitos na Efí

- A aplicação precisa ter a **API de Emissões** (Cobranças) ativada.
- A conta parceira precisa ser Efí, e o `payee_code` é o identificador da conta dela.
- A Efí cobra a tarifa da conta emissora.

## Ainda não verificado

- Se a central do assinante e a impressão de fatura do MK-Auth mostram a linha digitável
  da Efí para um título de conta `fat`. O link do boleto Efí fica em `sis_lanc.url`.
- Se o MK-Auth desbloqueia sozinho o cliente pago por esta baixa. A baixa do Pix do backend
  faz o mesmo `UPDATE` e depende do próprio MK-Auth para isso.
- O `sis_gnettits`, que o MK-Auth usa para montar o boleto Efí dele, não é preenchido.
