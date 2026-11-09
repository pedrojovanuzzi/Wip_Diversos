# Addon de Split de Pagamento (MK-Auth)

Registra os boletos no banco **já com o split**: um percentual fixo de cada boleto vai
direto para a conta de um parceiro, e o resto fica na conta da Wip. O addon funciona com
mais de um banco:

| Banco | Situação | Como o repasse é feito |
|---|---|---|
| Efí | pronto | `items[].marketplace.repasses` (`payee_code` + percentual) na API de Cobranças |
| Sicoob | em construção | `rateioCreditos` da API Cobrança Bancária v3; os campos já existem, o registro ainda não |

## Como funciona

O MK-Auth registra o boleto no banco pelo código interno dele (criptografado), e esse
código não manda repasse. O addon faz o registro no lugar do MK-Auth:

1. **Perfil.** Cada perfil liga um banco a um parceiro: banco, conta de origem do
   MK-Auth (de onde vêm multa, juros e, na Efí, as credenciais), ambiente e os dados do
   repasse. Pode haver um perfil Efí e um Sicoob ao mesmo tempo.
2. **Ativar.** Ao ativar, o addon cria no `sis_boleto` uma conta **"SPLIT \<PERFIL\>
   (ADDON)"**: uma cópia da conta de origem com `gateway='fat'`, `utilizar='fatura'` e
   `calc_boleto='nao'`. O MK-Auth gera os títulos dessa conta, mas não os registra em
   banco nenhum. Ativar **não move nenhum cliente**.
3. **Escolher clientes, à mão.** Na tela, busque por nome, login ou CPF/CNPJ, marque os
   clientes e clique em **Colocar no split**. A conta do cliente (`sis_cliente.conta`)
   vira a conta do perfil, e a conta anterior fica guardada em `addon_split_clientes`.
   **Tirar do split** devolve o cliente à conta anterior. Um cliente fica em um perfil
   só por vez.
4. **Registro.** De 5 em 5 minutos, o cron registra no banco, com o repasse, cada título
   novo das contas dos perfis ativos. Depois o addon preenche no `sis_lanc` o que o banco
   devolve (na Efí: `chave_gnet2`, `linhadig` e `url`).
5. **Acompanhamento** dos títulos já registrados:
   - apagado no MK-Auth, ou pago por outro meio: cancela no banco;
   - valor mudou: cancela e registra de novo;
   - vencimento mudou: atualiza no banco.
6. **Baixa.** O banco avisa em `retorno.php?p=<perfil>&t=<token>`. O provedor confere o
   aviso no próprio banco, e o addon dá a baixa do jeito da baixa nativa (`formapag` do
   banco e lançamento no `sis_caixa`), com `coletor='addon.split'`.

**Desativar** um perfil devolve todos os clientes dele à conta anterior. Se ficassem na
conta `fat`, o MK-Auth geraria títulos sem registro. O que já foi registrado no banco
continua valendo, e o retorno continua dando baixa nesses títulos.

**Boletos sem split:** os títulos que já existiam na conta antiga quando o cliente entrou
no split continuam sem split. O split só vale para os títulos gerados a partir daí.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.php` | Tela no painel (Provedor > Split Efi). Exige login do MK-Auth. |
| `lib.php` | Perfis, seleção de clientes, registro, acompanhamento e baixa. Bloqueado na web. |
| `provedores/Provedor.php` | O contrato de um banco. Para um banco novo: copie `sicoob.php`, implemente e registre em `provedores_disponiveis()`. |
| `provedores/efi.php` | Efí: API de Cobranças, autenticação, registro com `repasses`, cancelamento e notificações. |
| `provedores/sicoob.php` | Sicoob: só os campos e as pendências. As chamadas à API ainda lançam "não implementado". |
| `cron.php` | Rodada do agendamento (`/etc/cron.d/split_efi`, a cada 5 min). Só registra e acompanha; **não move clientes**. |
| `retorno.php` | Aviso de pagamento do banco. Público, mas exige o token aleatório e confere tudo no banco. |
| `install.sh` | Instala no servidor: copia os arquivos, liga o `addons.class.php` ao `include/addons.inc.hhvm` do MK-Auth (o mesmo link que o `scripts/addons.php` dele mantém), põe o item no menu, cria o cron e as tabelas. Só mexe em permissão de arquivo de verdade: um `chmod` que atravessasse o link derrubaria todos os addons do MK-Auth. |

Tabelas criadas no `mkradius`: `addon_split_config`, `addon_split_perfis`,
`addon_split_clientes`, `addon_split_titulos` e `addon_split_log`. Uma instalação da
versão 0.1, que tinha um perfil Efí só, é convertida para o perfil 1 sozinha.

## Instalar

No servidor do MK-Auth, como root, de dentro desta pasta:

```sh
sh install.sh
```

Depois, no painel, abra **Provedor > Split Efi**:

1. Informe o endereço público do MK-Auth, só o endereço:
   `https://mk.suaempresa.com.br`.
2. Crie um perfil (por exemplo, "Efí – Parceiro X") e escolha a conta de origem, o
   ambiente e os dados do repasse.
3. Clique em **Testar credencial** e depois em **Ativar**.
4. Em **Clientes**, marque quem entra no split e clique em **Colocar no split**.

## Pré-requisitos

- **Efí:** a aplicação precisa ter a API de Emissões (Cobranças) ativada. As
  credenciais de produção e homologação ficam na conta de origem do MK-Auth. A conta
  parceira precisa ser Efí, diferente da emissora. A tarifa é cobrada da conta emissora.
- **Sicoob:** ainda falta escrever a integração com a documentação oficial
  (developers.sicoob.com.br). Ela vai precisar do Client ID da API Cobrança Bancária v3,
  do certificado A1 em PEM no servidor e dos dados da conta do parceiro.

## Ainda não verificado

- Se a central do assinante e a impressão de fatura do MK-Auth mostram a linha digitável
  do banco para um título de conta `fat`. O link do boleto fica em `sis_lanc.url`.
- Se o MK-Auth desbloqueia sozinho o cliente pago por esta baixa.
- O `sis_gnettits` não é preenchido.
