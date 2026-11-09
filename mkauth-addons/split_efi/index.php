<?php
// Login do painel do MK-Auth: o addons.class.php barra quem não está logado e monta $Manifest.
include('addons.class.php');
require __DIR__ . '/lib.php';

garantir_tabelas();
if (cfg('token_retorno') === null) {
    cfg_set('token_retorno', bin2hex(random_bytes(24)));
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
if (empty($_SESSION['split_efi_csrf'])) {
    $_SESSION['split_efi_csrf'] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION['split_efi_csrf'];

function h($s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

/** Data do banco (Y-m-d ou Y-m-d H:i:s) para dd/mm/aaaa [hh:mm]. */
function sefi_data($s, bool $hora = false): string
{
    $s = (string) $s;
    if ($s === '' || strpos($s, '0000-00-00') === 0) {
        return '—';
    }
    $t = strtotime($s);
    if ($t === false) {
        return $s;
    }
    return date($hora ? 'd/m/Y H:i' : 'd/m/Y', $t);
}

function sefi_reais($v): string
{
    if ($v === null || $v === '') {
        return '—';
    }
    return 'R$ ' . number_format((float) $v, 2, ',', '.');
}

$aviso = null;
$erro = null;
$info = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!hash_equals($csrf, (string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Sessão expirada. Recarregue a página.');
        }
        $acao = (string) ($_POST['acao'] ?? '');
        if ($acao === 'salvar') {
            $origem = (int) ($_POST['conta_origem'] ?? 0);
            if ($origem && !in_array($origem, array_map('intval', array_column(contas_efi(), 'id')), true)) {
                throw new RuntimeException('Conta de origem inválida.');
            }
            if (cfg('ativo') === '1' && $origem !== (int) cfg('conta_origem', '0')) {
                throw new RuntimeException('Desative o split antes de trocar a conta de origem.');
            }

            // Percentual: aceita "10", "10,5", "10.50" e "10%".
            $pct = str_replace([',', '%', ' '], ['.', '', ''], trim((string) ($_POST['percentual'] ?? '')));
            if (!is_numeric($pct)) {
                throw new RuntimeException('Percentual inválido. Use só números, por exemplo 10 ou 10,5.');
            }

            // Endereço público: guarda só esquema://host[:porta]. O caminho do retorno o addon completa.
            $urlDigitada = trim((string) ($_POST['url_base'] ?? ''));
            $urlBase = '';
            if ($urlDigitada !== '') {
                $p = parse_url($urlDigitada);
                if (!is_array($p)) {
                    $p = [];
                }
                $esquema = strtolower((string) ($p['scheme'] ?? ''));
                $host = strtolower((string) ($p['host'] ?? ''));
                if (!in_array($esquema, ['http', 'https'], true) || $host === '') {
                    throw new RuntimeException('Endereço público inválido. Ele precisa começar com http:// ou https://. Ex.: https://mk.suaempresa.com.br');
                }
                $urlBase = $esquema . '://' . $host . (isset($p['port']) ? ':' . (int) $p['port'] : '');
                $sobra = rtrim((string) ($p['path'] ?? ''), '/');
                if ($sobra !== '' || isset($p['query']) || isset($p['fragment'])) {
                    $info = 'O endereço público foi salvo como ' . $urlBase . '. O resto que você digitou ('
                          . $sobra . (isset($p['query']) ? '?' . $p['query'] : '')
                          . ') foi removido: o addon completa o caminho do aviso sozinho.';
                }
            }

            cfg_set('conta_origem', (string) $origem);
            cfg_set('ambiente', ($_POST['ambiente'] ?? '') === 'producao' ? 'producao' : 'homologacao');
            cfg_set('payee_code', substr((string) preg_replace('/[^A-Za-z0-9]/', '', (string) ($_POST['payee_code'] ?? '')), 0, 64));
            cfg_set('percentual', number_format((float) $pct, 2, '.', ''));
            cfg_set('url_base', $urlBase);
            $aviso = 'Configuração salva.';
        } elseif ($acao === 'testar') {
            efi_token(true);
            $aviso = 'Credencial aceita pela Efí (' . (ambiente() === 'producao' ? 'produção' : 'homologação') . ').';
        } elseif ($acao === 'ativar') {
            ativar();
            $aviso = 'Split ativado. Os clientes da conta de origem passaram para a conta do split.';
        } elseif ($acao === 'desativar') {
            $n = desativar();
            $aviso = "Split desativado. $n cliente(s) voltaram para a conta anterior.";
        } elseif ($acao === 'rodar') {
            if (cfg('ativo') === '1') {
                mover_clientes();
                $n = registrar_pendentes();
            } else {
                $n = 0;
            }
            sincronizar();
            $aviso = "Rodada feita: $n título(s) tentados.";
        }
    } catch (Throwable $e) {
        $erro = $e->getMessage();
        $info = null;
    }
}

$ativo = cfg('ativo', '0') === '1';
$producao = ambiente() === 'producao';
$faltas = pendencias_config();
$split = conta_split_id();
$movidos = (int) (q1("SELECT COUNT(*) n FROM addon_split_clientes")['n'] ?? 0);
$resumo = [];
foreach (q("SELECT situacao, COUNT(*) n FROM addon_split_titulos GROUP BY situacao") as $r) {
    $resumo[$r['situacao']] = (int) $r['n'];
}
$titulos = q("SELECT a.id_lanc, a.charge_id, a.situacao, a.valor, a.vencimento, a.tentativas, a.erro, a.atualizado_em, l.login
                FROM addon_split_titulos a LEFT JOIN sis_lanc l ON l.id = a.id_lanc
            ORDER BY a.atualizado_em DESC LIMIT 30");
$logs = q("SELECT data, nivel, mensagem FROM addon_split_log ORDER BY id DESC LIMIT 30");

// Dados da tela
$contas = contas_efi();
$origemId = (int) cfg('conta_origem', '0');
$origemNome = '';
foreach ($contas as $c) {
    if ((int) $c['id'] === $origemId) {
        $origemNome = (string) $c['nome'];
    }
}
$nOrigem = $origemId ? (int) (q1("SELECT COUNT(*) n FROM sis_cliente WHERE conta = ?", [(string) $origemId])['n'] ?? 0) : 0;

// Situação de cada passo (mesmas regras do pendencias_config)
$origemRow = conta_origem();
$credOk = false;
if ($origemRow) {
    [$cid, $csec] = credenciais($origemRow);
    $credOk = $cid !== '' && $csec !== '';
}
$passo1 = $origemRow && $credOk;
$payee = (string) cfg('payee_code', '');
$pctEfi = percentual_efi();
$passo2 = trim($payee) !== '' && $pctEfi > 0 && $pctEfi < 10000;
$urlBaseCfg = (string) cfg('url_base', '');
$passo3 = (bool) preg_match('#^https?://#', $urlBaseCfg);

$pctCfg = (string) cfg('percentual', '');
$pctTela = $pctCfg === '' ? '' : number_format((float) str_replace(',', '.', $pctCfg), 2, ',', '');

$caminhoRetorno = '/admin/addons/split_efi/retorno.php?t=••••••';

$situacoes = [
    'registrado' => ['Registrado', 'azul', 'Registrado na Efí com o split. Aguardando pagamento.'],
    'pago'       => ['Pago', 'verde', 'Pago e baixado no MK-Auth.'],
    'erro'       => ['Erro', 'vermelho', 'A Efí recusou ou não respondeu. O addon tenta de novo até ' . SPLIT_MAX_TENTATIVAS . ' vezes.'],
    'cancelado'  => ['Cancelado', 'cinza', 'Cancelado na Efí (título apagado ou pago por outro meio).'],
    'substituir' => ['Refazer', 'laranja', 'O valor mudou: o boleto antigo foi cancelado e vai ser registrado de novo.'],
];

$nErro = $resumo['erro'] ?? 0;

// Textos da decisão
$plural = function (int $n): string {
    return $n . ' ' . ($n === 1 ? 'cliente' : 'clientes');
};
$contaTxt = $origemId ? ('#' . $origemId . ($origemNome !== '' ? ' – ' . $origemNome : '')) : '';
$destinoTxt = $split ? ('a conta do split (#' . $split . ')') : 'uma conta nova "EFI SPLIT (ADDON)", criada agora';
if ($ativo) {
    $confirmar = 'Devolver ' . $plural($movidos) . ' para a conta anterior?';
} else {
    $confirmar = 'Mover ' . $plural($nOrigem) . ' da conta ' . $contaTxt . ' para o split?';
    if ($producao) {
        $confirmar .= "\n\nATENÇÃO: ambiente de PRODUÇÃO. Os boletos vão ser cobranças reais.";
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR" class="has-navbar-fixed-top">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta charset="utf-8">
<title>MK-AUTH :: <?php echo h($Manifest->{'name'}); ?></title>
<link href="../../estilos/mk-auth.css" rel="stylesheet" type="text/css" />
<link href="../../estilos/font-awesome.css" rel="stylesheet" type="text/css" />
<link href="../../estilos/bi-icons.css" rel="stylesheet" type="text/css" />
<script src="../../scripts/jquery.js"></script>
<script src="../../scripts/mk-auth.js"></script>
<style>
  .sefi {
    --sefi-card: #23262b;
    --sefi-card2: #1c1e22;
    --sefi-borda: #353941;
    --sefi-texto: #e4e6ea;
    --sefi-fraco: #9aa1ab;
    --sefi-azul: #5aa9ff;
    --sefi-verde: #3fcf7a;
    --sefi-vermelho: #ff6b6b;
    --sefi-laranja: #ffa94d;
    --sefi-amarelo: #f5c542;
    --sefi-cinza: #8a9099;
    box-sizing: border-box;
    max-width: 1100px;
    margin: 0 auto;
    padding: 8px 16px 40px;
    color: var(--sefi-texto);
  }
  .sefi *, .sefi *::before, .sefi *::after { box-sizing: border-box; }
  .sefi code, .sefi .mono { font-family: Consolas, "DejaVu Sans Mono", Menlo, monospace; }
  .sefi a { color: var(--sefi-azul); }

  /* cabeçalho */
  .sefi-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 8px 0 12px; }
  .sefi-head h1 { font-size: 1.6rem; font-weight: 700; color: var(--sefi-texto); margin: 0 0 4px; line-height: 1.2; }
  .sefi-head p { color: var(--sefi-fraco); margin: 0; max-width: 640px; }
  .sefi-selos { display: flex; flex-wrap: wrap; gap: 8px; }
  .sefi-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: .9rem; border: 1px solid var(--sefi-borda); background: var(--sefi-card); white-space: nowrap; }
  .sefi-pill .bola { width: 10px; height: 10px; border-radius: 50%; background: var(--sefi-cinza); }
  .sefi-pill.on { color: var(--sefi-verde); border-color: rgba(63, 207, 122, .5); background: rgba(63, 207, 122, .1); }
  .sefi-pill.on .bola { background: var(--sefi-verde); box-shadow: 0 0 0 3px rgba(63, 207, 122, .25); }
  .sefi-pill.off { color: var(--sefi-fraco); }
  .sefi-pill.prod { color: #1b1b1b; background: var(--sefi-amarelo); border-color: var(--sefi-amarelo); }
  .sefi-pill.homolog { color: var(--sefi-azul); border-color: rgba(90, 169, 255, .45); background: rgba(90, 169, 255, .08); }

  .sefi-como { background: var(--sefi-card2); border: 1px solid var(--sefi-borda); border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; }
  .sefi-como summary { cursor: pointer; font-weight: 600; color: var(--sefi-texto); }
  .sefi-como ol { margin: 10px 0 2px 20px; color: var(--sefi-fraco); list-style: decimal; }
  .sefi-como li { margin-bottom: 4px; }

  /* mensagens */
  .sefi-msg { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 8px; margin-bottom: 12px; border: 1px solid; overflow-wrap: anywhere; }
  .sefi-msg .fa { margin-top: 3px; }
  .sefi-msg.ok { color: #c9f5d9; background: rgba(63, 207, 122, .12); border-color: rgba(63, 207, 122, .45); }
  .sefi-msg.erro { color: #ffd6d6; background: rgba(255, 107, 107, .12); border-color: rgba(255, 107, 107, .5); }
  .sefi-msg.info { color: #d6e9ff; background: rgba(90, 169, 255, .1); border-color: rgba(90, 169, 255, .45); }

  /* cartões de resumo */
  .sefi-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .sefi-card { background: var(--sefi-card); border: 1px solid var(--sefi-borda); border-radius: 10px; padding: 12px 14px; min-width: 0; }
  .sefi-card .rot { color: var(--sefi-fraco); font-size: .85rem; display: flex; align-items: center; gap: 6px; }
  .sefi-card .num { font-size: 1.7rem; font-weight: 700; line-height: 1.3; color: var(--sefi-texto); }
  .sefi-card .det { color: var(--sefi-fraco); font-size: .78rem; }
  .sefi-card.alerta { border-color: rgba(255, 107, 107, .6); }
  .sefi-card.alerta .num, .sefi-card.alerta .rot { color: var(--sefi-vermelho); }

  /* passos */
  .sefi h2 { font-size: 1.15rem; font-weight: 700; color: var(--sefi-texto); margin: 24px 0 10px; }
  .sefi-passos { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
  .sefi-passo { background: var(--sefi-card); border: 1px solid var(--sefi-borda); border-radius: 10px; padding: 14px 16px 16px; min-width: 0; }
  .sefi-passo-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .sefi-passo-n { flex: none; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; background: var(--sefi-card2); border: 1px solid var(--sefi-borda); }
  .sefi-passo.ok .sefi-passo-n { background: var(--sefi-verde); border-color: var(--sefi-verde); color: #10301d; }
  .sefi-passo-top h3 { flex: 1; font-size: 1rem; font-weight: 700; margin: 0; color: var(--sefi-texto); }
  .sefi-estado { font-size: .78rem; white-space: nowrap; }
  .sefi-estado.ok { color: var(--sefi-verde); }
  .sefi-estado.pend { color: var(--sefi-amarelo); }
  .sefi .field { margin-bottom: 12px; }
  .sefi .label { color: var(--sefi-texto); }
  .sefi .help { color: var(--sefi-fraco); font-size: .78rem; }
  .sefi-aviso-prod { display: none; margin-top: 6px; font-size: .8rem; color: var(--sefi-amarelo); }
  .sefi-aviso-prod.on { display: block; }
  .sefi-exemplo { background: var(--sefi-card2); border: 1px dashed var(--sefi-borda); border-radius: 8px; padding: 10px 12px; font-size: .9rem; }
  .sefi-exemplo b { color: var(--sefi-texto); }
  .sefi-exemplo .parc { color: var(--sefi-azul); }
  .sefi-exemplo .wip { color: var(--sefi-verde); }
  .sefi-barra { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 8px; background: var(--sefi-verde); }
  .sefi-barra span { display: block; height: 100%; background: var(--sefi-azul); width: 0; transition: width .2s; }
  .sefi-url { display: block; background: var(--sefi-card2); border: 1px solid var(--sefi-borda); border-radius: 6px; padding: 8px 10px; font-size: .8rem; color: var(--sefi-texto); overflow-wrap: anywhere; }
  .sefi-url-nota { font-size: .78rem; color: var(--sefi-amarelo); margin-top: 4px; min-height: 1em; }

  /* ações */
  .sefi-acoes { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 16px; }
  .sefi-acoes-nota { color: var(--sefi-fraco); font-size: .8rem; margin-top: 6px; }
  .sefi-pend { background: rgba(245, 197, 66, .07); border: 1px solid rgba(245, 197, 66, .35); border-radius: 10px; padding: 12px 16px; margin-top: 18px; }
  .sefi-pend p { font-weight: 600; margin: 0 0 6px; color: var(--sefi-amarelo); }
  .sefi-pend ul { margin: 0; list-style: none; }
  .sefi-pend li { display: flex; gap: 8px; align-items: baseline; color: var(--sefi-texto); padding: 2px 0; }
  .sefi-pend li .fa { color: var(--sefi-amarelo); }
  .sefi-pronto { color: var(--sefi-verde); margin-top: 18px; display: flex; gap: 8px; align-items: center; }
  .sefi-decisao { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between; margin-top: 18px; padding: 16px; border-radius: 10px; border: 2px solid var(--sefi-verde); background: rgba(63, 207, 122, .06); }
  .sefi-decisao.desligar { border-color: rgba(255, 107, 107, .7); background: rgba(255, 107, 107, .06); }
  .sefi-decisao.bloq { border-color: var(--sefi-borda); background: var(--sefi-card); }
  .sefi-decisao-txt { flex: 1 1 320px; min-width: 0; }
  .sefi-decisao-txt h3 { font-size: 1.05rem; font-weight: 700; margin: 0 0 4px; color: var(--sefi-texto); }
  .sefi-decisao-txt p { margin: 0; color: var(--sefi-fraco); }
  .sefi-decisao-txt p b { color: var(--sefi-texto); }
  .sefi-decisao .button { min-width: 160px; font-weight: 700; }

  /* tabela e registro */
  .sefi-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--sefi-borda); border-radius: 10px; background: var(--sefi-card); }
  .sefi-tab { width: 100%; border-collapse: collapse; font-size: .85rem; }
  .sefi-tab th { text-align: left; color: var(--sefi-fraco); font-weight: 600; padding: 9px 10px; border-bottom: 1px solid var(--sefi-borda); white-space: nowrap; }
  .sefi-tab td { padding: 8px 10px; border-bottom: 1px solid rgba(255, 255, 255, .05); color: var(--sefi-texto); vertical-align: top; white-space: nowrap; }
  .sefi-tab tr:last-child td { border-bottom: 0; }
  .sefi-tab td.num { text-align: right; }
  .sefi-tab td.erro-txt { white-space: normal; min-width: 180px; max-width: 320px; color: var(--sefi-vermelho); }
  .sefi-tab .fraco { color: var(--sefi-fraco); }
  .sefi-tag { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: .75rem; font-weight: 700; border: 1px solid; cursor: help; }
  .sefi-tag.azul { color: var(--sefi-azul); border-color: rgba(90, 169, 255, .5); background: rgba(90, 169, 255, .1); }
  .sefi-tag.verde { color: var(--sefi-verde); border-color: rgba(63, 207, 122, .5); background: rgba(63, 207, 122, .1); }
  .sefi-tag.vermelho { color: var(--sefi-vermelho); border-color: rgba(255, 107, 107, .5); background: rgba(255, 107, 107, .1); }
  .sefi-tag.cinza { color: var(--sefi-cinza); border-color: rgba(138, 144, 153, .5); background: rgba(138, 144, 153, .1); }
  .sefi-tag.laranja { color: var(--sefi-laranja); border-color: rgba(255, 169, 77, .5); background: rgba(255, 169, 77, .1); }
  .sefi-vazio { padding: 22px 16px; text-align: center; color: var(--sefi-fraco); }
  .sefi-vazio .fa { display: block; font-size: 1.6rem; margin-bottom: 6px; opacity: .6; }
  .sefi-log { list-style: none; margin: 0; padding: 4px 0; font-size: .82rem; }
  .sefi-log li { display: flex; gap: 12px; padding: 6px 12px; border-left: 3px solid transparent; }
  .sefi-log li + li { border-top: 1px solid rgba(255, 255, 255, .04); }
  .sefi-log .quando { flex: none; color: var(--sefi-fraco); font-family: Consolas, "DejaVu Sans Mono", Menlo, monospace; }
  .sefi-log .msg { min-width: 0; overflow-wrap: anywhere; color: var(--sefi-texto); }
  .sefi-log li.erro { border-left-color: var(--sefi-vermelho); background: rgba(255, 107, 107, .07); }
  .sefi-log li.erro .msg { color: #ffc4c4; }

  @media (max-width: 600px) {
    .sefi-head h1 { font-size: 1.3rem; }
    .sefi-passos { grid-template-columns: 1fr; }
    .sefi-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sefi-acoes .button, .sefi-decisao .button { width: 100%; }
    .sefi-log li { flex-direction: column; gap: 2px; }
  }
</style>
</head>
<body>
<?php include('../../topo.php'); ?>

<nav class="breadcrumb has-bullet-separator is-centered" aria-label="breadcrumbs">
<ul>
<li><a href="#"> ADDON</a></li>
<li class="is-active"><a href="#" aria-current="page"> <?php echo h(strtoupper($Manifest->{'name'} . ' # ' . $Manifest->{'version'})); ?> </a></li>
</ul>
</nav>

<div class="sefi">

<header class="sefi-head">
  <div>
    <h1>Split de pagamento Efí</h1>
    <p>Cada boleto é registrado na Efí já dividido: uma parte vai direto para a conta do parceiro e o resto fica com a Wip.</p>
  </div>
  <div class="sefi-selos">
    <?php if ($ativo): ?>
      <span class="sefi-pill on"><span class="bola"></span>Ativo</span>
    <?php else: ?>
      <span class="sefi-pill off"><span class="bola"></span>Desativado</span>
    <?php endif; ?>
    <?php if ($producao): ?>
      <span class="sefi-pill prod"><i class="fa fa-exclamation-triangle"></i>PRODUÇÃO – cobranças reais</span>
    <?php else: ?>
      <span class="sefi-pill homolog"><i class="fa fa-flask"></i>Homologação (teste)</span>
    <?php endif; ?>
  </div>
</header>

<details class="sefi-como">
  <summary>Como funciona</summary>
  <ol>
    <li>Os clientes da conta Efí de origem passam para uma conta própria do addon ("EFI SPLIT (ADDON)"). A conta antiga de cada um fica guardada.</li>
    <li>A cada 5 minutos o addon registra na Efí os boletos novos dessa conta, já com a divisão<?php echo $pctTela !== '' ? ': ' . h($pctTela) . '% para o parceiro e o resto para a Wip' : ''; ?>.</li>
    <li>Quando o cliente paga, a Efí avisa o MK-Auth (pelo endereço do passo 3) e o addon dá a baixa sozinho.</li>
    <li>Desativar devolve os clientes para a conta anterior. Boletos já registrados continuam valendo e a baixa deles continua automática.</li>
  </ol>
</details>

<?php if ($aviso): ?><div class="sefi-msg ok"><i class="fa fa-check-circle"></i><div><?php echo h($aviso); ?></div></div><?php endif; ?>
<?php if ($info): ?><div class="sefi-msg info"><i class="fa fa-info-circle"></i><div><?php echo h($info); ?></div></div><?php endif; ?>
<?php if ($erro): ?><div class="sefi-msg erro"><i class="fa fa-times-circle"></i><div><?php echo h($erro); ?></div></div><?php endif; ?>

<div class="sefi-cards">
  <div class="sefi-card">
    <div class="rot"><i class="fa fa-users"></i>Clientes no split</div>
    <div class="num"><?php echo (int) $movidos; ?></div>
  </div>
  <div class="sefi-card">
    <div class="rot"><i class="fa fa-file-text-o"></i>Títulos registrados</div>
    <div class="num"><?php echo (int) ($resumo['registrado'] ?? 0); ?></div>
    <div class="det">aguardando pagamento</div>
  </div>
  <div class="sefi-card">
    <div class="rot"><i class="fa fa-check"></i>Pagos</div>
    <div class="num"><?php echo (int) ($resumo['pago'] ?? 0); ?></div>
  </div>
  <div class="sefi-card<?php echo $nErro > 0 ? ' alerta' : ''; ?>">
    <div class="rot"><i class="fa fa-exclamation-circle"></i>Com erro</div>
    <div class="num"><?php echo (int) $nErro; ?></div>
    <?php if (($resumo['cancelado'] ?? 0) || ($resumo['substituir'] ?? 0)): ?>
      <div class="det"><?php echo (int) ($resumo['cancelado'] ?? 0); ?> cancelado(s) · <?php echo (int) ($resumo['substituir'] ?? 0); ?> a refazer</div>
    <?php endif; ?>
  </div>
  <div class="sefi-card">
    <div class="rot"><i class="fa fa-university"></i>Conta do split</div>
    <div class="num"><?php echo $split ? '#' . (int) $split : '—'; ?></div>
    <div class="det"><?php echo $split ? 'conta de cobrança do addon' : 'criada ao ativar'; ?></div>
  </div>
</div>

<form method="post" id="sefi-form" autocomplete="off">
  <input type="hidden" name="csrf" value="<?php echo h($csrf); ?>">

  <h2>Configuração</h2>
  <div class="sefi-passos">

    <section class="sefi-passo<?php echo $passo1 ? ' ok' : ''; ?>">
      <div class="sefi-passo-top">
        <span class="sefi-passo-n"><?php echo $passo1 ? '<i class="fa fa-check"></i>' : '1'; ?></span>
        <h3>Conta Efí e ambiente</h3>
        <?php if ($passo1): ?><span class="sefi-estado ok"><i class="fa fa-check-circle"></i> Pronto</span>
        <?php else: ?><span class="sefi-estado pend"><i class="fa fa-clock-o"></i> Pendente</span><?php endif; ?>
      </div>
      <div class="field">
        <label class="label" for="sefi-origem">Conta Efí de origem</label>
        <div class="select is-fullwidth"><select name="conta_origem" id="sefi-origem">
          <option value="0">— escolha —</option>
          <?php foreach ($contas as $c): ?>
            <option value="<?php echo (int) $c['id']; ?>" <?php echo $origemId === (int) $c['id'] ? 'selected' : ''; ?>><?php echo (int) $c['id'] . ' - ' . h($c['nome']); ?></option>
          <?php endforeach; ?>
        </select></div>
        <p class="help">Os clientes desta conta passam para o split. O Client ID/Secret da Efí vem dela.<?php echo $ativo ? ' Para trocar de conta, desative o split primeiro.' : ''; ?></p>
      </div>
      <div class="field">
        <label class="label" for="sefi-amb">Ambiente</label>
        <div class="select is-fullwidth"><select name="ambiente" id="sefi-amb">
          <option value="homologacao" <?php echo $producao ? '' : 'selected'; ?>>Homologação (teste)</option>
          <option value="producao" <?php echo $producao ? 'selected' : ''; ?>>Produção (cobranças reais)</option>
        </select></div>
        <p class="sefi-aviso-prod<?php echo $producao ? ' on' : ''; ?>" id="sefi-aviso-prod"><i class="fa fa-exclamation-triangle"></i> Em produção os boletos são cobrados de verdade dos clientes.</p>
      </div>
    </section>

    <section class="sefi-passo<?php echo $passo2 ? ' ok' : ''; ?>">
      <div class="sefi-passo-top">
        <span class="sefi-passo-n"><?php echo $passo2 ? '<i class="fa fa-check"></i>' : '2'; ?></span>
        <h3>Parceiro</h3>
        <?php if ($passo2): ?><span class="sefi-estado ok"><i class="fa fa-check-circle"></i> Pronto</span>
        <?php else: ?><span class="sefi-estado pend"><i class="fa fa-clock-o"></i> Pendente</span><?php endif; ?>
      </div>
      <div class="field">
        <label class="label" for="sefi-payee">payee_code do parceiro</label>
        <input class="input mono" id="sefi-payee" name="payee_code" maxlength="64" spellcheck="false" autocomplete="off" value="<?php echo h($payee); ?>">
        <p class="help">Identificador de conta do parceiro na Efí (painel Efí &gt; API &gt; Introdução &gt; Identificador de conta). Precisa ser uma conta diferente da que emite o boleto.</p>
      </div>
      <div class="field">
        <label class="label" for="sefi-pct">% para o parceiro</label>
        <input class="input" id="sefi-pct" name="percentual" inputmode="decimal" value="<?php echo h($pctTela); ?>" placeholder="ex.: 10,00">
        <p class="help">O resto fica na conta Efí da Wip.</p>
      </div>
      <div class="sefi-exemplo" id="sefi-exemplo" aria-live="polite">Preencha o percentual para ver um exemplo.</div>
    </section>

    <section class="sefi-passo<?php echo $passo3 ? ' ok' : ''; ?>">
      <div class="sefi-passo-top">
        <span class="sefi-passo-n"><?php echo $passo3 ? '<i class="fa fa-check"></i>' : '3'; ?></span>
        <h3>Aviso de pagamento</h3>
        <?php if ($passo3): ?><span class="sefi-estado ok"><i class="fa fa-check-circle"></i> Pronto</span>
        <?php else: ?><span class="sefi-estado pend"><i class="fa fa-clock-o"></i> Pendente</span><?php endif; ?>
      </div>
      <div class="field">
        <label class="label" for="sefi-url">Endereço público do MK-Auth</label>
        <input class="input" id="sefi-url" name="url_base" inputmode="url" spellcheck="false" value="<?php echo h($urlBaseCfg); ?>" placeholder="https://mk.suaempresa.com.br">
        <p class="help">Só o endereço, sem caminho. Ex.: https://mk.suaempresa.com.br</p>
      </div>
      <div class="field">
        <span class="label">A Efí vai avisar os pagamentos em</span>
        <code class="sefi-url" id="sefi-url-prev"><?php echo $urlBaseCfg !== '' ? h($urlBaseCfg . $caminhoRetorno) : '(preencha o endereço acima)'; ?></code>
        <p class="sefi-url-nota" id="sefi-url-nota"></p>
        <p class="help">Esse endereço precisa abrir pela internet, senão a baixa automática não acontece.</p>
      </div>
    </section>

  </div>

  <div class="sefi-acoes">
    <button class="button is-link" name="acao" value="salvar"><i class="fa fa-floppy-o"></i>&nbsp; Salvar</button>
    <button class="button" name="acao" value="testar" onclick="return sefiConfirmar('');"><i class="fa fa-plug"></i>&nbsp; Testar credencial</button>
    <button class="button" name="acao" value="rodar" onclick="return sefiConfirmar('');"><i class="fa fa-refresh"></i>&nbsp; Rodar agora</button>
  </div>
  <p class="sefi-acoes-nota"><b>Testar credencial</b> confere o Client ID/Secret com a Efí. <b>Rodar agora</b> faz na hora o que o agendamento faz a cada 5 minutos.</p>

  <?php if ($faltas): ?>
    <div class="sefi-pend">
      <p><i class="fa fa-list-ul"></i> Antes de ativar, falta:</p>
      <ul>
        <?php foreach ($faltas as $f): ?>
          <li><i class="fa fa-square-o"></i><span><?php echo h($f); ?></span></li>
        <?php endforeach; ?>
      </ul>
    </div>
  <?php elseif (!$ativo): ?>
    <p class="sefi-pronto"><i class="fa fa-check-circle"></i> Tudo preenchido. Dá para ativar.</p>
  <?php endif; ?>

  <?php if ($ativo): ?>
    <div class="sefi-decisao desligar">
      <div class="sefi-decisao-txt">
        <h3>Desativar o split</h3>
        <p>Vai devolver <b><?php echo h($plural($movidos)); ?></b> para a conta anterior. Boletos já registrados na Efí continuam valendo e a baixa deles continua automática.</p>
      </div>
      <button class="button is-danger" name="acao" value="desativar" onclick="return sefiConfirmar(<?php echo h(json_encode($confirmar, JSON_UNESCAPED_UNICODE)); ?>);"><i class="fa fa-power-off"></i>&nbsp; Desativar</button>
    </div>
  <?php else: ?>
    <div class="sefi-decisao<?php echo $faltas ? ' bloq' : ''; ?>">
      <div class="sefi-decisao-txt">
        <h3>Ativar o split</h3>
        <?php if ($origemId): ?>
          <p>Vai mover <b><?php echo h($plural($nOrigem)); ?></b> da conta <b><?php echo h($contaTxt); ?></b> para <?php echo h($destinoTxt); ?>. Clientes cadastrados depois nessa conta também são movidos a cada 5 minutos.</p>
        <?php else: ?>
          <p>Escolha a conta Efí de origem no passo 1 e salve.</p>
        <?php endif; ?>
        <?php if ($producao): ?><p style="color:var(--sefi-amarelo)"><i class="fa fa-exclamation-triangle"></i> Ambiente de produção: os boletos vão ser cobranças reais.</p><?php endif; ?>
      </div>
      <button class="button is-success" name="acao" value="ativar" <?php echo $faltas ? 'disabled title="Complete os itens pendentes antes de ativar."' : ''; ?>
        onclick="return sefiConfirmar(<?php echo h(json_encode($confirmar, JSON_UNESCAPED_UNICODE)); ?>);"><i class="fa fa-power-off"></i>&nbsp; Ativar</button>
    </div>
  <?php endif; ?>
</form>

<h2>Últimos títulos</h2>
<div class="sefi-scroll">
<?php if (!$titulos): ?>
  <div class="sefi-vazio"><i class="fa fa-inbox"></i>Nenhum boleto registrado ainda. Depois de ativar, o primeiro aparece aqui em até 5 minutos.</div>
<?php else: ?>
  <table class="sefi-tab">
    <thead>
      <tr><th>Título</th><th>Cliente</th><th>Valor</th><th>Vencimento</th><th>Situação</th><th>Tentativas</th><th>Charge Efí</th><th>Erro</th><th>Atualizado</th></tr>
    </thead>
    <tbody>
    <?php foreach ($titulos as $t): ?>
      <?php
        $sit = $situacoes[$t['situacao']] ?? [(string) $t['situacao'], 'cinza', ''];
        $errTxt = (string) $t['erro'];
        $errCurto = mb_strlen($errTxt) > 70 ? mb_substr($errTxt, 0, 70) . '…' : $errTxt;
      ?>
      <tr>
        <td><?php echo (int) $t['id_lanc']; ?></td>
        <td><?php echo $t['login'] !== null && $t['login'] !== '' ? h($t['login']) : '<span class="fraco">—</span>'; ?></td>
        <td class="num"><?php echo h(sefi_reais($t['valor'])); ?></td>
        <td><?php echo h(sefi_data($t['vencimento'])); ?></td>
        <td><span class="sefi-tag <?php echo h($sit[1]); ?>" title="<?php echo h($sit[2]); ?>"><?php echo h($sit[0]); ?></span></td>
        <td class="num"><?php echo (int) $t['tentativas']; ?></td>
        <td class="mono"><?php echo $t['charge_id'] ? h($t['charge_id']) : '<span class="fraco">—</span>'; ?></td>
        <td class="erro-txt" title="<?php echo h($errTxt); ?>"><?php echo h($errCurto); ?></td>
        <td class="fraco"><?php echo h(sefi_data($t['atualizado_em'], true)); ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
<?php endif; ?>
</div>

<h2>Registro</h2>
<div class="sefi-scroll">
<?php if (!$logs): ?>
  <div class="sefi-vazio"><i class="fa fa-list-alt"></i>Nada registrado ainda.</div>
<?php else: ?>
  <ul class="sefi-log">
    <?php foreach ($logs as $l): ?>
      <li class="<?php echo $l['nivel'] === 'erro' ? 'erro' : ''; ?>">
        <span class="quando"><?php echo h(sefi_data($l['data'], true)); ?></span>
        <span class="msg"><?php echo $l['nivel'] === 'erro' ? '<i class="fa fa-exclamation-circle"></i> ' : ''; ?><?php echo h($l['mensagem']); ?></span>
      </li>
    <?php endforeach; ?>
  </ul>
<?php endif; ?>
</div>

</div>

<script>
(function () {
  var form = document.getElementById('sefi-form');
  if (!form) { return; }

  // Alterações não salvas: Testar, Rodar e Ativar usam o que já está salvo.
  function estado() {
    var partes = [];
    var els = form.querySelectorAll('input[name], select[name]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].type !== 'hidden') { partes.push(els[i].name + '=' + els[i].value); }
    }
    return partes.join('&');
  }
  var inicial = estado();
  window.sefiConfirmar = function (msg) {
    if (estado() !== inicial) {
      if (!confirm('Você mudou campos e ainda não salvou. Esta ação usa a configuração salva.\n\nContinuar mesmo assim?')) {
        return false;
      }
    }
    return msg ? confirm(msg) : true;
  };

  // Aviso de produção
  var amb = document.getElementById('sefi-amb');
  var avisoProd = document.getElementById('sefi-aviso-prod');
  if (amb && avisoProd) {
    amb.addEventListener('change', function () {
      avisoProd.className = 'sefi-aviso-prod' + (amb.value === 'producao' ? ' on' : '');
    });
  }

  // Exemplo do percentual
  var pct = document.getElementById('sefi-pct');
  var ex = document.getElementById('sefi-exemplo');
  function reais(centavos) {
    var s = (centavos / 100).toFixed(2).split('.');
    return 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }
  function atualizaExemplo() {
    var v = pct.value.replace('%', '').replace(/\s/g, '').replace(',', '.');
    if (v === '') { ex.textContent = 'Preencha o percentual para ver um exemplo.'; return; }
    if (!/^\d+(\.\d*)?$/.test(v)) { ex.textContent = 'Use só números, por exemplo 10 ou 10,5.'; return; }
    var p = parseFloat(v);
    if (!(p > 0 && p < 100)) { ex.textContent = 'O percentual tem que ser maior que 0 e menor que 100.'; return; }
    var parc = Math.round(p * 100); // centavos de um boleto de R$ 100,00
    var wip = 10000 - parc;
    ex.innerHTML = '';
    var linha = document.createElement('div');
    linha.appendChild(document.createTextNode('Num boleto de '));
    var b = document.createElement('b'); b.textContent = 'R$ 100,00'; linha.appendChild(b);
    linha.appendChild(document.createTextNode(': '));
    var bp = document.createElement('b'); bp.className = 'parc'; bp.textContent = reais(parc); linha.appendChild(bp);
    linha.appendChild(document.createTextNode(' vai para o parceiro e '));
    var bw = document.createElement('b'); bw.className = 'wip'; bw.textContent = reais(wip); linha.appendChild(bw);
    linha.appendChild(document.createTextNode(' fica com a Wip.'));
    ex.appendChild(linha);
    var barra = document.createElement('div'); barra.className = 'sefi-barra';
    var parte = document.createElement('span'); parte.style.width = (parc / 100) + '%';
    barra.appendChild(parte); ex.appendChild(barra);
  }
  if (pct && ex) { pct.addEventListener('input', atualizaExemplo); atualizaExemplo(); }

  // Prévia do endereço de aviso
  var url = document.getElementById('sefi-url');
  var prev = document.getElementById('sefi-url-prev');
  var nota = document.getElementById('sefi-url-nota');
  var caminho = <?php echo json_encode($caminhoRetorno, JSON_UNESCAPED_UNICODE); ?>;
  function atualizaUrl() {
    var v = url.value.trim();
    nota.textContent = '';
    if (v === '') { prev.textContent = '(preencha o endereço acima)'; return; }
    var m = /^(https?):\/\/([^\/?#]+)(.*)$/i.exec(v);
    if (!m) {
      prev.textContent = '(endereço inválido)';
      nota.textContent = 'Comece com http:// ou https://';
      return;
    }
    var host = m[2].replace(/^[^@]*@/, '');
    prev.textContent = m[1].toLowerCase() + '://' + host.toLowerCase() + caminho;
    if (m[3] !== '' && m[3] !== '/') {
      nota.textContent = 'O caminho "' + m[3] + '" vai ser removido ao salvar.';
    }
  }
  if (url && prev && nota) { url.addEventListener('input', atualizaUrl); atualizaUrl(); }
})();
</script>

<?php include('../../baixo.php'); ?>
<script src="../../menu.js.hhvm"></script>
</body>
</html>
