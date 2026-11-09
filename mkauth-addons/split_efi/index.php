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

$aviso = null;
$erro = null;
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
            cfg_set('conta_origem', (string) $origem);
            cfg_set('ambiente', ($_POST['ambiente'] ?? '') === 'producao' ? 'producao' : 'homologacao');
            cfg_set('payee_code', preg_replace('/[^A-Za-z0-9]/', '', (string) ($_POST['payee_code'] ?? '')));
            $pct = str_replace(',', '.', trim((string) ($_POST['percentual'] ?? '')));
            if (!is_numeric($pct)) {
                throw new RuntimeException('Percentual inválido.');
            }
            cfg_set('percentual', number_format((float) $pct, 2, '.', ''));
            cfg_set('url_base', rtrim(trim((string) ($_POST['url_base'] ?? '')), '/'));
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
    }
}

$ativo = cfg('ativo', '0') === '1';
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
  .split-wrap { max-width: 1100px; margin: 0 auto; padding: 0 16px 32px; }
  .split-tab td, .split-tab th { padding: 4px 8px; font-size: 13px; vertical-align: top; }
  .split-erro { color: #b00020; }
  .split-ok { color: #1b7a3a; }
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

<div class="split-wrap">
<?php if ($aviso): ?><div class="notification is-success"><?php echo h($aviso); ?></div><?php endif; ?>
<?php if ($erro): ?><div class="notification is-danger"><?php echo h($erro); ?></div><?php endif; ?>

<div class="columns">
  <div class="column">
    <p>Situação</p>
    <p class="has-text-weight-bold is-size-4 <?php echo $ativo ? 'split-ok' : ''; ?>"><?php echo $ativo ? 'ATIVO' : 'DESATIVADO'; ?></p>
  </div>
  <div class="column"><p>Ambiente Efí</p><p class="has-text-weight-bold is-size-4"><?php echo ambiente() === 'producao' ? 'Produção' : 'Homologação'; ?></p></div>
  <div class="column"><p>Conta do split</p><p class="has-text-weight-bold is-size-4"><?php echo $split ?: '—'; ?></p></div>
  <div class="column"><p>Clientes no split</p><p class="has-text-weight-bold is-size-4"><?php echo $movidos; ?></p></div>
  <div class="column"><p>Títulos</p><p class="is-size-6">
    <?php foreach (['registrado', 'pago', 'erro', 'cancelado', 'substituir'] as $s): ?>
      <?php echo h($s) . ': <b>' . ($resumo[$s] ?? 0) . '</b><br>'; ?>
    <?php endforeach; ?></p></div>
</div>

<form method="post" class="box">
  <input type="hidden" name="csrf" value="<?php echo h($csrf); ?>">
  <div class="columns is-multiline">
    <div class="column is-4">
      <label class="label">Conta Efí de origem</label>
      <div class="select is-fullwidth"><select name="conta_origem">
        <option value="0">— escolha —</option>
        <?php foreach (contas_efi() as $c): ?>
          <option value="<?php echo (int) $c['id']; ?>" <?php echo (int) cfg('conta_origem', '0') === (int) $c['id'] ? 'selected' : ''; ?>>
            <?php echo (int) $c['id'] . ' - ' . h($c['nome']); ?></option>
        <?php endforeach; ?>
      </select></div>
      <p class="help">Os clientes desta conta passam para o split. As credenciais da Efí vêm dela.</p>
    </div>
    <div class="column is-2">
      <label class="label">Ambiente</label>
      <div class="select is-fullwidth"><select name="ambiente">
        <option value="homologacao" <?php echo ambiente() === 'homologacao' ? 'selected' : ''; ?>>Homologação</option>
        <option value="producao" <?php echo ambiente() === 'producao' ? 'selected' : ''; ?>>Produção</option>
      </select></div>
    </div>
    <div class="column is-3">
      <label class="label">payee_code do parceiro</label>
      <input class="input" name="payee_code" value="<?php echo h(cfg('payee_code', '')); ?>" autocomplete="off">
    </div>
    <div class="column is-3">
      <label class="label">% para o parceiro</label>
      <input class="input" name="percentual" value="<?php echo h(cfg('percentual', '')); ?>" placeholder="ex.: 10,00">
      <p class="help">O resto fica na conta Efí da Wip.</p>
    </div>
    <div class="column is-6">
      <label class="label">Endereço público do MK-Auth</label>
      <input class="input" name="url_base" value="<?php echo h(cfg('url_base', '')); ?>" placeholder="https://mk.seudominio.com.br">
      <p class="help">A Efí avisa o pagamento em <code>&lt;endereço&gt;/admin/addons/split_efi/retorno.php</code>.</p>
    </div>
  </div>
  <button class="button is-link" name="acao" value="salvar">Salvar</button>
  <button class="button" name="acao" value="testar">Testar credencial</button>
  <button class="button" name="acao" value="rodar">Rodar agora</button>
  <?php if ($ativo): ?>
    <button class="button is-danger" name="acao" value="desativar" onclick="return confirm('Devolver todos os clientes para a conta anterior?');">Desativar</button>
  <?php else: ?>
    <button class="button is-success" name="acao" value="ativar" <?php echo $faltas ? 'disabled' : ''; ?>
      onclick="return confirm('Passar todos os clientes da conta de origem para o split?');">Ativar</button>
  <?php endif; ?>
  <?php if ($faltas): ?><ul class="split-erro" style="margin-top:8px"><?php foreach ($faltas as $f) echo '<li>' . h($f) . '</li>'; ?></ul><?php endif; ?>
</form>

<h3 class="title is-5">Últimos títulos</h3>
<table class="table is-fullwidth is-striped split-tab">
<tr><th>Título</th><th>Login</th><th>Valor</th><th>Venc.</th><th>Charge</th><th>Situação</th><th>Tent.</th><th>Erro</th><th>Atualizado</th></tr>
<?php foreach ($titulos as $t): ?>
<tr>
  <td><?php echo (int) $t['id_lanc']; ?></td><td><?php echo h($t['login']); ?></td>
  <td><?php echo h(number_format((float) $t['valor'], 2, ',', '.')); ?></td><td><?php echo h($t['vencimento']); ?></td>
  <td><?php echo h($t['charge_id']); ?></td><td><?php echo h($t['situacao']); ?></td><td><?php echo (int) $t['tentativas']; ?></td>
  <td class="split-erro"><?php echo h($t['erro']); ?></td><td><?php echo h($t['atualizado_em']); ?></td>
</tr>
<?php endforeach; ?>
</table>

<h3 class="title is-5">Registro</h3>
<table class="table is-fullwidth split-tab">
<?php foreach ($logs as $l): ?>
<tr class="<?php echo $l['nivel'] === 'erro' ? 'split-erro' : ''; ?>"><td style="white-space:nowrap"><?php echo h($l['data']); ?></td><td><?php echo h($l['mensagem']); ?></td></tr>
<?php endforeach; ?>
</table>
</div>

<?php include('../../baixo.php'); ?>
<script src="../../menu.js.hhvm"></script>
</body>
</html>
