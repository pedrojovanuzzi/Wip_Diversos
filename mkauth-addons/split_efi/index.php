<?php
// Login do painel do MK-Auth: o addons.class.php barra quem não está logado e monta $Manifest.
require __DIR__ . '/addons.class.php';
// Se o addons.class.php não barrou nem montou o $Manifest, o login do MK-Auth
// não respondeu como esperado: fecha a porta em vez de abrir a tela.
if (!isset($Manifest) || !is_object($Manifest)) {
    http_response_code(403);
    exit('Acesso negado.');
}
require __DIR__ . '/lib.php';

garantir_tabelas();
token_retorno(); // cria o token do aviso de pagamento na primeira vez

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
if (empty($_SESSION['split_efi_csrf'])) {
    $_SESSION['split_efi_csrf'] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION['split_efi_csrf'];

const SEFI_MAX_LOGINS = 1500;      // clientes por ação (colocar/tirar) = maior página
const SEFI_CAMINHO_RETORNO = '/admin/addons/split_efi/retorno.php';

// ---------------------------------------------------------------- ajudas da tela

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

/** "1 cliente" / "3 clientes". */
function sefi_n(int $n, string $um, string $varios): string
{
    return $n . ' ' . ($n === 1 ? $um : $varios);
}

/** Percentual salvo ("10.50") para a tela ("10,50"). */
function sefi_pct_tela($v): string
{
    $v = trim((string) $v);
    if ($v === '') {
        return '';
    }
    $n = str_replace(',', '.', $v);
    return is_numeric($n) ? number_format((float) $n, 2, ',', '') : $v;
}

/** CPF/CNPJ com os dígitos do meio escondidos: 123.***.***-45. */
function sefi_doc($doc): string
{
    $d = (string) preg_replace('/\D/', '', (string) $doc);
    $n = strlen($d);
    if ($n === 11) {
        return substr($d, 0, 3) . '.***.***-' . substr($d, 9, 2);
    }
    if ($n === 14) {
        return substr($d, 0, 2) . '.***.***/****-' . substr($d, 12, 2);
    }
    if ($n === 0) {
        return '';
    }
    if ($n <= 4) {
        return str_repeat('*', $n);
    }
    return substr($d, 0, 2) . str_repeat('*', $n - 4) . substr($d, -2);
}

/** Lista curta de logins para as mensagens. */
function sefi_logins_txt(array $l): string
{
    $t = implode(', ', array_slice($l, 0, 8));
    if (count($l) > 8) {
        $t .= ' e mais ' . (count($l) - 8);
    }
    return $t;
}

/** Perfil escolhido, busca, filtro e página, sempre validados. */
function sefi_estado(array $src): array
{
    $f = is_string($src['f'] ?? null) ? $src['f'] : 'fora';
    if (!in_array($f, ['fora', 'perfil', 'todos'], true)) {
        $f = 'fora';
    }
    $q = is_string($src['q'] ?? null) ? mb_substr(trim($src['q']), 0, 80) : '';
    $pg = is_scalar($src['pg'] ?? null) ? (int) $src['pg'] : 1;
    $perfil = is_scalar($src['perfil'] ?? null) ? (int) $src['perfil'] : 0;
    $pp = is_scalar($src['pp'] ?? null) ? (int) $src['pp'] : SPLIT_POR_PAGINA;
    if (!in_array($pp, SPLIT_POR_PAGINA_OPCOES, true)) {
        $pp = SPLIT_POR_PAGINA;
    }
    return [
        'perfil' => max(0, $perfil),
        'q' => $q,
        'f' => $f,
        'pg' => min(100000, max(1, $pg)),
        'pp' => $pp,
    ];
}

/** Endereço desta tela com o estado (sem os valores padrão). */
function sefi_link(array $e, array $muda = [], string $ancora = ''): string
{
    $e = array_merge($e, $muda);
    $p = [];
    if (!empty($e['perfil'])) {
        $p['perfil'] = (int) $e['perfil'];
    }
    if (($e['q'] ?? '') !== '') {
        $p['q'] = $e['q'];
    }
    if (($e['f'] ?? 'fora') !== 'fora') {
        $p['f'] = $e['f'];
    }
    if (($e['pg'] ?? 1) > 1) {
        $p['pg'] = (int) $e['pg'];
    }
    if (($e['pp'] ?? SPLIT_POR_PAGINA) !== SPLIT_POR_PAGINA) {
        $p['pp'] = (int) $e['pp'];
    }
    if (!empty($e['novo'])) {
        $p['novo'] = 1;
    }
    return '?' . http_build_query($p) . ($ancora !== '' ? '#' . $ancora : '');
}

/** Campos escondidos que levam o estado da tela no POST (para voltar ao mesmo lugar). */
function sefi_campos_estado(array $e): string
{
    $html = '';
    foreach (['perfil', 'q', 'f', 'pg', 'pp'] as $k) {
        $html .= '<input type="hidden" name="' . $k . '" value="' . h($e[$k]) . '">';
    }
    return $html;
}

function sefi_flash(string $tipo, string $texto, string $onde): void
{
    $_SESSION['split_efi_flash'][] = [$tipo, $texto, $onde];
}

/** Mostra as mensagens de um lugar da tela. */
function sefi_mostrar(array $flashes, string $onde): void
{
    $icones = ['ok' => 'fa-check-circle', 'erro' => 'fa-times-circle', 'info' => 'fa-info-circle'];
    foreach ($flashes as $f) {
        if (!is_array($f) || ($f[2] ?? '') !== $onde || !isset($icones[$f[0] ?? ''])) {
            continue;
        }
        echo '<div class="sefi-msg ' . h($f[0]) . '" role="' . ($f[0] === 'erro' ? 'alert' : 'status') . '">'
           . '<i class="fa ' . $icones[$f[0]] . '"></i><div>' . h($f[1] ?? '') . '</div></div>';
    }
}

/** Perfil do POST: id inteiro e existente. */
function sefi_perfil_post(): array
{
    $id = filter_var($_POST['perfil'] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $p = $id ? perfil((int) $id) : null;
    if (!$p) {
        throw new RuntimeException('Perfil não encontrado. Recarregue a página.');
    }
    return $p;
}

/** Logins marcados: texto de 1 a 64 caracteres, no máximo SEFI_MAX_LOGINS. */
function sefi_logins_post(): array
{
    // A tela manda os marcados num campo só (logins_lista, um por linha): com
    // 1500 checkboxes, logins[] passaria do max_input_vars do PHP (1000).
    if (isset($_POST['logins_lista']) && is_string($_POST['logins_lista'])) {
        $l = preg_split('/\r?\n/', $_POST['logins_lista'], -1, PREG_SPLIT_NO_EMPTY);
    } else {
        $l = $_POST['logins'] ?? [];
    }
    if (!is_array($l)) {
        throw new RuntimeException('Lista de clientes inválida. Recarregue a página.');
    }
    foreach ($l as $x) {
        if (!is_string($x) || $x === '' || strlen($x) > 64) {
            throw new RuntimeException('Lista de clientes inválida. Recarregue a página.');
        }
    }
    $l = array_values(array_unique($l));
    if (!$l) {
        throw new RuntimeException('Marque pelo menos um cliente na lista.');
    }
    if (count($l) > SEFI_MAX_LOGINS) {
        throw new RuntimeException('Dá para mexer em no máximo ' . SEFI_MAX_LOGINS . ' clientes de uma vez.');
    }
    return $l;
}

/** Endereço público digitado → esquema://host[:porta]. Devolve [url, aviso do que foi removido]. */
function sefi_normalizar_url(string $digitada): array
{
    $digitada = trim($digitada);
    if ($digitada === '') {
        return ['', null];
    }
    $p = parse_url($digitada);
    if (!is_array($p)) {
        $p = [];
    }
    $esquema = strtolower((string) ($p['scheme'] ?? ''));
    $host = strtolower((string) ($p['host'] ?? ''));
    if (!in_array($esquema, ['http', 'https'], true) || $host === '') {
        throw new RuntimeException('Endereço público inválido. Ele precisa começar com http:// ou https://. Ex.: https://mk.suaempresa.com.br');
    }
    $url = $esquema . '://' . $host . (isset($p['port']) ? ':' . (int) $p['port'] : '');
    $info = null;
    $sobra = rtrim((string) ($p['path'] ?? ''), '/');
    if ($sobra !== '' || isset($p['query']) || isset($p['fragment'])) {
        $info = 'O endereço público foi salvo como ' . $url . '. O resto que você digitou ('
              . $sobra . (isset($p['query']) ? '?' . $p['query'] : '')
              . ') foi removido: o addon completa o caminho do aviso sozinho.';
    }
    return [$url, $info];
}

// ---------------------------------------------------------------- ações (POST → mensagem → volta)

$ehPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$estado = sefi_estado($ehPost ? $_POST : $_GET);

if ($ehPost) {
    $acao = is_string($_POST['acao'] ?? null) ? $_POST['acao'] : '';
    $lugares = [
        'salvar_url' => 'url',
        'criar_perfil' => 'perfil',
        'salvar' => 'perfil',
        'testar' => 'perfil',
        'ativar' => 'perfil',
        'desativar' => 'perfil',
        'excluir' => 'perfil',
        'colocar' => 'clientes',
        'tirar' => 'clientes',
    ];
    $onde = $lugares[$acao] ?? 'topo';
    $ancoras = ['url' => 'sefi-url-card', 'perfil' => 'sefi-perfil', 'clientes' => 'sefi-clientes', 'topo' => ''];
    $muda = [];
    try {
        if (!hash_equals($csrf, is_string($_POST['csrf'] ?? null) ? $_POST['csrf'] : '')) {
            throw new RuntimeException('Sessão expirada. Recarregue a página e tente de novo.');
        }
        if (!isset($lugares[$acao])) {
            throw new RuntimeException('Ação desconhecida.');
        }

        if ($acao === 'salvar_url') {
            [$url, $info] = sefi_normalizar_url(is_string($_POST['url_base'] ?? null) ? $_POST['url_base'] : '');
            cfg_set('url_base', $url);
            sefi_flash('ok', $url === '' ? 'Endereço público apagado.' : 'Endereço público salvo.', $onde);
            if ($info) {
                sefi_flash('info', $info, $onde);
            }
        } elseif ($acao === 'criar_perfil') {
            $muda = ['novo' => 1]; // se der erro, volta para o formulário de novo perfil
            $prov = is_string($_POST['provedor'] ?? null) ? $_POST['provedor'] : '';
            if (!isset(provedores_disponiveis()[$prov])) {
                throw new RuntimeException('Escolha o banco do perfil.');
            }
            $nome = mb_substr(trim(is_string($_POST['nome'] ?? null) ? $_POST['nome'] : ''), 0, 60);
            $id = salvar_perfil(null, ['nome' => $nome, 'provedor' => $prov, 'ambiente' => 'homologacao']);
            $muda = ['perfil' => $id, 'q' => '', 'f' => 'fora', 'pg' => 1, 'novo' => 0];
            $criado = perfil($id);
            sefi_flash('ok', 'Perfil “' . ($criado['nome'] ?? $nome) . '” criado. Agora preencha os dados abaixo e salve.', $onde);
        } else {
            $p = sefi_perfil_post();
            $pid = (int) $p['id'];
            $ativo = (int) $p['ativo'] === 1;
            $classe = provedores_disponiveis()[$p['provedor']] ?? null;
            if (!$classe) {
                throw new RuntimeException('Banco desconhecido neste perfil: ' . $p['provedor'] . '.');
            }

            if ($acao === 'salvar') {
                $post = is_array($_POST['campo'] ?? null) ? $_POST['campo'] : [];
                $dados = [];
                $senhas = [];
                foreach ($classe::campos() as $c) {
                    $k = (string) $c[0];
                    $v = $post[$k] ?? '';
                    $dados[$k] = is_string($v) ? $v : '';
                    if (($c[2] ?? '') === 'password') {
                        $senhas[] = $k;
                    }
                }
                $dados['nome'] = mb_substr(trim(is_string($_POST['nome'] ?? null) ? $_POST['nome'] : ''), 0, 60);
                $dados['conta_origem'] = is_scalar($_POST['conta_origem'] ?? null) ? (int) $_POST['conta_origem'] : 0;
                $dados['ambiente'] = ($_POST['ambiente'] ?? '') === 'producao' ? 'producao' : 'homologacao';
                try {
                    if ($ativo && $dados['ambiente'] !== $p['ambiente']) {
                        throw new RuntimeException('Desative o perfil antes de trocar o ambiente.');
                    }
                    salvar_perfil($pid, $dados);
                } catch (Throwable $e) {
                    // Devolve o que foi digitado para a tela (nunca as senhas).
                    $_SESSION['split_efi_form'] = ['perfil' => $pid, 'dados' => array_diff_key($dados, array_flip($senhas))];
                    throw $e;
                }
                sefi_flash('ok', 'Perfil salvo.', $onde);
            } elseif ($acao === 'testar') {
                if (!$classe::implementado()) {
                    throw new RuntimeException('A integração com o ' . $classe::nome() . ' ainda está em construção: não dá para testar a credencial.');
                }
                provedor($p)->testar();
                sefi_flash('ok', 'Credencial aceita pelo ' . $classe::nome() . ' (' . ($p['ambiente'] === 'producao' ? 'produção' : 'homologação') . ').', $onde);
            } elseif ($acao === 'ativar') {
                ativar_perfil($pid);
                sefi_flash('ok', 'Perfil ativado. Agora escolha, na lista de clientes abaixo, quem entra no split.', $onde);
            } elseif ($acao === 'desativar') {
                $n = desativar_perfil($pid);
                sefi_flash('ok', 'Perfil desativado. ' . sefi_n($n, 'cliente voltou', 'clientes voltaram') . ' para a conta anterior.', $onde);
            } elseif ($acao === 'excluir') {
                excluir_perfil($pid);
                $muda = ['perfil' => 0, 'q' => '', 'f' => 'fora', 'pg' => 1];
                $onde = 'topo';
                sefi_flash('ok', 'Perfil “' . $p['nome'] . '” excluído. A conta de cobrança dele continua no MK-Auth.', $onde);
            } elseif ($acao === 'colocar') {
                $logins = sefi_logins_post();
                [$movidos, $ignorados] = colocar_no_split($pid, $logins);
                $semMudanca = max(0, count($logins) - $movidos - count($ignorados));
                $txt = $movidos
                    ? sefi_n($movidos, 'cliente colocado', 'clientes colocados') . ' no split.'
                    : 'Nenhum cliente novo colocado no split.';
                if ($ignorados) {
                    $txt .= ' ' . sefi_n(count($ignorados), 'ignorado porque já está', 'ignorados porque já estão')
                          . ' em outro perfil (' . sefi_logins_txt($ignorados) . ').';
                }
                if ($semMudanca) {
                    $txt .= ' ' . sefi_n($semMudanca, 'já estava', 'já estavam') . ' neste perfil.';
                }
                sefi_flash($movidos ? 'ok' : 'info', $txt, $onde);
                if ($movidos) {
                    sefi_flash('info', 'Os boletos gerados daqui para frente para esses clientes saem pela conta do split e são registrados com repasse em até 5 minutos. Boletos que já existiam continuam na conta antiga.', $onde);
                }
            } elseif ($acao === 'tirar') {
                $logins = sefi_logins_post();
                $marcas = implode(',', array_fill(0, count($logins), '?'));
                $deste = array_map('strval', array_column(
                    q("SELECT login FROM addon_split_clientes WHERE perfil_id = ? AND login IN ($marcas)", array_merge([$pid], $logins)),
                    'login'
                ));
                $outros = array_values(array_diff($logins, $deste));
                $n = $deste ? tirar_do_split($deste) : 0;
                $txt = $n
                    ? sefi_n($n, 'cliente tirado', 'clientes tirados') . ' do split e ' . ($n === 1 ? 'devolvido' : 'devolvidos') . ' à conta anterior.'
                    : 'Nenhum cliente tirado do split.';
                if ($outros) {
                    $txt .= ' ' . sefi_n(count($outros), 'ignorado porque não está', 'ignorados porque não estão')
                          . ' neste perfil (' . sefi_logins_txt($outros) . ').';
                }
                sefi_flash($n ? 'ok' : 'info', $txt, $onde);
            }
        }
    } catch (Throwable $e) {
        sefi_flash('erro', $e->getMessage(), $onde);
    }

    $estado = array_merge($estado, $muda);
    // Volta para a tela por GET: recarregar a página não repete a ação.
    if (!headers_sent()) {
        header('Location: ' . sefi_link($estado, [], $ancoras[$onde] ?? ''), true, 303);
        exit;
    }
    // Se algo já escreveu na saída, desenha a tela direto (as mensagens saem igual).
}

$flashes = is_array($_SESSION['split_efi_flash'] ?? null) ? $_SESSION['split_efi_flash'] : [];
unset($_SESSION['split_efi_flash']);
$formVolta = is_array($_SESSION['split_efi_form'] ?? null) ? $_SESSION['split_efi_form'] : null;
unset($_SESSION['split_efi_form']);

// ---------------------------------------------------------------- dados da tela

$perfis = perfis();
$porPerfil = [];
foreach (q("SELECT perfil_id, COUNT(*) n FROM addon_split_clientes GROUP BY perfil_id") as $r) {
    $porPerfil[(int) $r['perfil_id']] = (int) $r['n'];
}
$nomesContas = [];
foreach (q("SELECT id, nome FROM sis_boleto") as $r) {
    $nomesContas[(int) $r['id']] = (string) $r['nome'];
}
$nomeConta = function ($id) use ($nomesContas): string {
    $id = (int) $id;
    if (!$id) {
        return '—';
    }
    return '#' . $id . (isset($nomesContas[$id]) && $nomesContas[$id] !== '' ? ' – ' . $nomesContas[$id] : '');
};
$nAtivos = 0;
foreach ($perfis as $p) {
    $nAtivos += (int) $p['ativo'] === 1 ? 1 : 0;
}
$bancos = [];
foreach (provedores_disponiveis() as $chave => $bClasse) {
    $bancos[$chave] = $bClasse;
}

$urlBaseCfg = url_base();
$urlOk = (bool) preg_match('#^https?://#', $urlBaseCfg);

$novo = !$perfis || (!$ehPost && !empty($_GET['novo']));
$sel = null;
if (!$novo) {
    foreach ($perfis as $p) {
        if ((int) $p['id'] === $estado['perfil']) {
            $sel = $p;
        }
    }
    if (!$sel) {
        if ($estado['perfil']) {
            $flashes[] = ['erro', 'Perfil não encontrado. Mostrando o primeiro da lista.', 'topo'];
        }
        $sel = $perfis[0];
        $estado = array_merge($estado, ['perfil' => (int) $sel['id'], 'q' => '', 'f' => 'fora', 'pg' => 1]);
    }
}

if ($sel) {
    $pid = (int) $sel['id'];
    $classe = $bancos[$sel['provedor']] ?? null;
    $bancoNome = $classe ? $classe::nome() : (string) $sel['provedor'];
    $implementado = $classe ? $classe::implementado() : false;
    $campos = $classe ? $classe::campos() : [];
    $provErro = $classe ? '' : 'Este perfil usa um banco que o addon não conhece (' . $sel['provedor'] . ').';
    $faltas = [];
    if ($classe) {
        try {
            $faltas = pendencias_perfil($sel);
        } catch (Throwable $e) {
            $provErro = $e->getMessage();
        }
    }
    $ativo = (int) $sel['ativo'] === 1;
    $producao = $sel['ambiente'] === 'producao';
    $nClientes = $porPerfil[$pid] ?? 0;
    $contaSplit = (int) $sel['conta_split'];
    $contas = $classe ? contas_origem($sel['provedor']) : [];
    $origemId = (int) $sel['conta_origem'];
    $podeAtivar = $implementado && !$faltas && $provErro === '';

    $form = ($formVolta && (int) ($formVolta['perfil'] ?? 0) === $pid && is_array($formVolta['dados'] ?? null)) ? $formVolta['dados'] : [];
    $valorForm = function (string $k, $salvo) use ($form) {
        return array_key_exists($k, $form) ? $form[$k] : $salvo;
    };

    $resumo = [];
    foreach (q("SELECT situacao, COUNT(*) n FROM addon_split_titulos WHERE perfil_id = ? GROUP BY situacao", [$pid]) as $r) {
        $resumo[$r['situacao']] = (int) $r['n'];
    }
    $nErro = $resumo['erro'] ?? 0;
    $titulos = q("SELECT a.id_lanc, a.charge_id, a.situacao, a.valor, a.vencimento, a.tentativas, a.erro, a.atualizado_em, l.login
                    FROM addon_split_titulos a LEFT JOIN sis_lanc l ON l.id = a.id_lanc
                   WHERE a.perfil_id = ?
                ORDER BY a.atualizado_em DESC LIMIT 30", [$pid]);

    $lista = listar_clientes($estado['q'], $estado['f'], $pid, $estado['pg'], $estado['pp']);
    $paginas = max(1, (int) ceil($lista['total'] / $estado['pp']));
    if ($estado['pg'] > $paginas) {
        $estado['pg'] = $paginas;
        $lista = listar_clientes($estado['q'], $estado['f'], $pid, $estado['pg'], $estado['pp']);
    }

    $situacoes = [
        'registrado' => ['Registrado', 'azul', 'Registrado no ' . $bancoNome . ' com o repasse. Aguardando pagamento.'],
        'pago'       => ['Pago', 'verde', 'Pago e baixado no MK-Auth.'],
        'erro'       => ['Erro', 'vermelho', 'O banco recusou ou não respondeu. O addon tenta de novo até ' . SPLIT_MAX_TENTATIVAS . ' vezes.'],
        'cancelado'  => ['Cancelado', 'cinza', 'Cancelado no banco (título apagado ou pago por outro meio).'],
        'vencido'    => ['Vencido', 'laranja', 'O banco avisou que venceu sem pagamento.'],
        'substituir' => ['Refazer', 'laranja', 'O valor mudou: o boleto antigo foi cancelado e vai ser registrado de novo.'],
    ];

    $confAtivar = 'Ativar o perfil “' . $sel['nome'] . '”?' . "\n\n"
                . 'O addon testa a credencial' . ($contaSplit ? '' : ' e cria a conta de cobrança do perfil no MK-Auth') . '. '
                . 'Nenhum cliente muda de conta agora: depois você escolhe quem entra.';
    if ($producao) {
        $confAtivar .= "\n\nATENÇÃO: ambiente de PRODUÇÃO. Os boletos vão ser cobranças reais.";
    }
    $confDesativar = 'Desativar o perfil “' . $sel['nome'] . '”?' . "\n\n"
                   . sefi_n($nClientes, 'cliente volta', 'clientes voltam') . ' para a conta anterior. '
                   . 'Boletos já registrados no banco continuam valendo e a baixa deles continua automática.';
    $confExcluir = 'Excluir o perfil “' . $sel['nome'] . '”? Não dá para desfazer.'
                 . ($contaSplit ? "\n\nA conta de cobrança " . $nomeConta($contaSplit) . ' continua no MK-Auth.' : '');
    $confColocar = 'Colocar {n} no split do perfil “' . $sel['nome'] . '”?' . "\n\n"
                 . 'A conta de cobrança deles passa a ser a do perfil, e os próximos boletos saem com repasse.';
    if ($producao) {
        $confColocar .= "\n\nATENÇÃO: ambiente de PRODUÇÃO. Os boletos vão ser cobranças reais.";
    }
    $confTirar = 'Tirar {n} do split?' . "\n\n" . 'Eles voltam para a conta que tinham antes. Boletos já registrados no banco continuam valendo.';
}

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
  .sefi .fraco { color: var(--sefi-fraco); }

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
  .sefi-pill.mini { padding: 2px 8px; font-size: .72rem; gap: 5px; }
  .sefi-pill.mini .bola { width: 7px; height: 7px; }

  .sefi-como { background: var(--sefi-card2); border: 1px solid var(--sefi-borda); border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; }
  .sefi-como summary { cursor: pointer; font-weight: 600; color: var(--sefi-texto); }
  .sefi-como ol { margin: 10px 0 2px 20px; color: var(--sefi-fraco); list-style: decimal; }
  .sefi-como li { margin-bottom: 4px; }
  .sefi-como b { color: var(--sefi-texto); }

  /* mensagens */
  .sefi-msg { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 8px; margin-bottom: 12px; border: 1px solid; overflow-wrap: anywhere; }
  .sefi-msg .fa { margin-top: 3px; }
  .sefi-msg.ok { color: #c9f5d9; background: rgba(63, 207, 122, .12); border-color: rgba(63, 207, 122, .45); }
  .sefi-msg.erro { color: #ffd6d6; background: rgba(255, 107, 107, .12); border-color: rgba(255, 107, 107, .5); }
  .sefi-msg.info { color: #d6e9ff; background: rgba(90, 169, 255, .1); border-color: rgba(90, 169, 255, .45); }
  .sefi-msg.obra { color: #ffe9b3; background: rgba(245, 197, 66, .1); border-color: rgba(245, 197, 66, .5); }

  /* cartões de resumo */
  .sefi-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .sefi-card { background: var(--sefi-card); border: 1px solid var(--sefi-borda); border-radius: 10px; padding: 12px 14px; min-width: 0; }
  .sefi-card .rot { color: var(--sefi-fraco); font-size: .85rem; display: flex; align-items: center; gap: 6px; }
  .sefi-card .num { font-size: 1.7rem; font-weight: 700; line-height: 1.3; color: var(--sefi-texto); }
  .sefi-card .det { color: var(--sefi-fraco); font-size: .78rem; }
  .sefi-card.alerta { border-color: rgba(255, 107, 107, .6); }
  .sefi-card.alerta .num, .sefi-card.alerta .rot { color: var(--sefi-vermelho); }

  /* passos / cartões de formulário */
  .sefi h2 { font-size: 1.15rem; font-weight: 700; color: var(--sefi-texto); margin: 24px 0 10px; }
  .sefi h2 .fraco { font-weight: 400; font-size: .9rem; }
  .sefi-sub { color: var(--sefi-fraco); margin: -4px 0 12px; font-size: .9rem; }
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
  .sefi .label .fraco { font-weight: 400; font-size: .8rem; }
  .sefi .help { color: var(--sefi-fraco); font-size: .78rem; }
  .sefi-aviso-prod { display: none; margin-top: 6px; font-size: .8rem; color: var(--sefi-amarelo); }
  .sefi-aviso-prod.on { display: block; }
  .sefi-exemplo { background: var(--sefi-card2); border: 1px dashed var(--sefi-borda); border-radius: 8px; padding: 10px 12px; font-size: .9rem; margin-top: 8px; }
  .sefi-exemplo b { color: var(--sefi-texto); }
  .sefi-exemplo .parc { color: var(--sefi-azul); }
  .sefi-exemplo .wip { color: var(--sefi-verde); }
  .sefi-barra { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 8px; background: var(--sefi-verde); }
  .sefi-barra span { display: block; height: 100%; background: var(--sefi-azul); width: 0; transition: width .2s; }
  .sefi-url { display: block; background: var(--sefi-card2); border: 1px solid var(--sefi-borda); border-radius: 6px; padding: 8px 10px; font-size: .8rem; color: var(--sefi-texto); overflow-wrap: anywhere; }
  .sefi-url-nota { font-size: .78rem; color: var(--sefi-amarelo); margin-top: 4px; min-height: 1em; }
  .sefi-grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0 16px; }
  .sefi-trava { font-size: .78rem; color: var(--sefi-amarelo); }

  /* perfis em abas */
  .sefi-abas { display: flex; gap: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 2px 2px 6px; margin-bottom: 14px; }
  .sefi a.sefi-aba { flex: none; display: flex; flex-direction: column; gap: 4px; width: 220px; padding: 10px 12px; border: 1px solid var(--sefi-borda); border-radius: 10px; background: var(--sefi-card); color: var(--sefi-texto); text-decoration: none; }
  .sefi a.sefi-aba:hover { border-color: rgba(90, 169, 255, .6); }
  .sefi a.sefi-aba.atual { border-color: var(--sefi-azul); box-shadow: inset 0 -3px 0 var(--sefi-azul); background: rgba(90, 169, 255, .06); }
  .sefi-aba-nome { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sefi-aba-sub { font-size: .78rem; color: var(--sefi-fraco); }
  .sefi-aba-selos { display: flex; flex-wrap: wrap; gap: 4px; }
  .sefi a.sefi-aba.novo { justify-content: center; align-items: center; flex-direction: row; gap: 8px; width: auto; min-width: 150px; border-style: dashed; color: var(--sefi-azul); font-weight: 700; }
  .sefi-perfil-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin: 8px 0 12px; }
  .sefi-perfil-head h2 { margin: 0; font-size: 1.3rem; }
  .sefi-perfil-head .fraco { font-size: .85rem; }

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
  .sefi-decisao-txt p + p { margin-top: 4px; }
  .sefi-decisao-txt p b { color: var(--sefi-texto); }
  .sefi-decisao .button { min-width: 160px; font-weight: 700; }
  .sefi-perigo { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-top: 12px; padding: 10px 16px; border: 1px dashed var(--sefi-borda); border-radius: 10px; color: var(--sefi-fraco); font-size: .85rem; }
  .sefi-perigo p { margin: 0; flex: 1 1 300px; }

  /* clientes */
  .sefi-busca { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
  .sefi-busca .input { flex: 1 1 240px; min-width: 0; width: auto; }
  .sefi-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
  .sefi a.sefi-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 13px; border-radius: 999px; border: 1px solid var(--sefi-borda); background: var(--sefi-card); color: var(--sefi-fraco); text-decoration: none; font-size: .85rem; font-weight: 600; }
  .sefi a.sefi-chip:hover { color: var(--sefi-texto); }
  .sefi a.sefi-chip.on { color: #0f2540; background: var(--sefi-azul); border-color: var(--sefi-azul); }
  .sefi-total { color: var(--sefi-fraco); font-size: .85rem; margin: 0; }
  .sefi-total-linha { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 8px; }
  .sefi-pp { display: inline-flex; align-items: center; gap: 8px; color: var(--sefi-fraco); font-size: .85rem; }
  .sefi-pp select { background: var(--sefi-card); color: var(--sefi-texto); border: 1px solid var(--sefi-borda); border-radius: 6px; padding: 3px 8px; font-size: .85rem; }
  .sefi-tab td.sel, .sefi-tab th.sel { width: 36px; padding-right: 0; }
  .sefi-tab input[type=checkbox] { width: 18px; height: 18px; cursor: pointer; vertical-align: middle; }
  .sefi-tab input[type=checkbox]:disabled { cursor: not-allowed; opacity: .35; }
  .sefi-tab tr.marcado td { background: rgba(90, 169, 255, .08); }
  .sefi-tab label.nome { cursor: pointer; display: block; color: var(--sefi-texto); white-space: normal; min-width: 160px; }
  .sefi-sutil { display: block; font-size: .72rem; color: var(--sefi-fraco); }
  .sefi-tab .sefi-sutil.alerta { color: var(--sefi-laranja); }
  .sefi-pag { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 10px; }
  .sefi-pag a, .sefi-pag span { display: inline-flex; min-width: 34px; justify-content: center; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--sefi-borda); background: var(--sefi-card); font-size: .85rem; text-decoration: none; }
  .sefi-pag span.atual { background: var(--sefi-azul); border-color: var(--sefi-azul); color: #0f2540; font-weight: 700; }
  .sefi-pag span.gap { border: 0; background: none; color: var(--sefi-fraco); min-width: 0; padding: 4px 2px; }
  .sefi-acaobar { position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-top: 12px; padding: 10px 14px; background: var(--sefi-card2); border: 1px solid var(--sefi-borda); border-radius: 10px; box-shadow: 0 -6px 18px rgba(0, 0, 0, .4); }
  .sefi-acaobar-txt { min-width: 0; }
  .sefi-acaobar-txt b { display: block; color: var(--sefi-texto); }
  .sefi-acaobar-txt span { font-size: .78rem; color: var(--sefi-fraco); }
  .sefi-acaobar-bts { display: flex; flex-wrap: wrap; gap: 8px; }
  .sefi-acaobar-bts > span { display: inline-flex; }

  /* tabela e registro */
  .sefi-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--sefi-borda); border-radius: 10px; background: var(--sefi-card); }
  .sefi-tab { width: 100%; border-collapse: collapse; font-size: .85rem; }
  .sefi-tab th { text-align: left; color: var(--sefi-fraco); font-weight: 600; padding: 9px 10px; border-bottom: 1px solid var(--sefi-borda); white-space: nowrap; }
  .sefi-tab td { padding: 8px 10px; border-bottom: 1px solid rgba(255, 255, 255, .05); color: var(--sefi-texto); vertical-align: top; white-space: nowrap; overflow-wrap: normal; }
  .sefi-tab tr:last-child td { border-bottom: 0; }
  .sefi-tab td.num { text-align: right; }
  .sefi-tab td.erro-txt { white-space: normal; min-width: 180px; max-width: 320px; color: var(--sefi-vermelho); overflow-wrap: anywhere; }
  .sefi-tag { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: .75rem; font-weight: 700; border: 1px solid; cursor: help; white-space: nowrap; }
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
    .sefi-passos, .sefi-grade { grid-template-columns: 1fr; }
    .sefi-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sefi-acoes .button, .sefi-decisao .button, .sefi-perigo .button { width: 100%; }
    .sefi-acaobar-bts, .sefi-acaobar-bts > span, .sefi-acaobar-bts .button { width: 100%; }
    .sefi a.sefi-aba { width: 190px; }
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
    <h1>Split de pagamento</h1>
    <p>Cada boleto é registrado no banco já dividido: uma parte vai direto para a conta do parceiro e o resto fica com a Wip.</p>
  </div>
  <div class="sefi-selos">
    <?php if ($nAtivos > 0): ?>
      <span class="sefi-pill on"><span class="bola"></span><?php echo h(sefi_n($nAtivos, 'perfil ativo', 'perfis ativos')); ?></span>
    <?php else: ?>
      <span class="sefi-pill off"><span class="bola"></span>Nenhum perfil ativo</span>
    <?php endif; ?>
  </div>
</header>

<details class="sefi-como"<?php echo $perfis ? '' : ' open'; ?>>
  <summary>Como funciona</summary>
  <ol>
    <li><b>Crie um perfil</b> para cada banco e parceiro (por exemplo, “Efí – Parceiro João”).</li>
    <li><b>Preencha e ative.</b> Ao ativar, o addon testa a credencial e cria uma conta de cobrança própria do perfil no MK-Auth (“SPLIT … (ADDON)”).</li>
    <li><b>Escolha os clientes</b> na lista do perfil. A conta de cobrança deles passa a ser a do perfil; a anterior fica guardada.</li>
    <li><b>A cada 5 minutos</b> o addon registra no banco os boletos novos desses clientes, já com o repasse para o parceiro. Quando o cliente paga, o banco avisa e a baixa é automática.</li>
    <li><b>Tirar do split</b> (ou desativar o perfil) devolve o cliente para a conta anterior. Boletos já registrados continuam valendo.</li>
  </ol>
</details>

<?php sefi_mostrar($flashes, 'topo'); ?>

<section class="sefi-passo<?php echo $urlOk ? ' ok' : ''; ?>" id="sefi-url-card">
  <div class="sefi-passo-top">
    <span class="sefi-passo-n"><?php echo $urlOk ? '<i class="fa fa-check"></i>' : '<i class="fa fa-globe"></i>'; ?></span>
    <h3>Endereço público do MK-Auth</h3>
    <?php if ($urlOk): ?><span class="sefi-estado ok"><i class="fa fa-check-circle"></i> Pronto</span>
    <?php else: ?><span class="sefi-estado pend"><i class="fa fa-clock-o"></i> Pendente</span><?php endif; ?>
  </div>
  <?php sefi_mostrar($flashes, 'url'); ?>
  <form method="post" autocomplete="off">
    <input type="hidden" name="csrf" value="<?php echo h($csrf); ?>">
    <?php echo sefi_campos_estado($estado); ?>
    <div class="sefi-grade">
      <div class="field">
        <label class="label" for="sefi-url">Endereço público</label>
        <input class="input" id="sefi-url" name="url_base" inputmode="url" spellcheck="false" maxlength="255" value="<?php echo h($urlBaseCfg); ?>" placeholder="https://mk.suaempresa.com.br">
        <p class="help">Só o endereço, sem caminho. Vale para todos os perfis. Se mudar, os boletos já registrados continuam avisando no endereço antigo.</p>
      </div>
      <div class="field">
        <span class="label">Os bancos vão avisar os pagamentos em</span>
        <code class="sefi-url" id="sefi-url-prev"><?php echo $urlBaseCfg !== '' ? h($urlBaseCfg . SEFI_CAMINHO_RETORNO . '?p=…&t=••••••') : '(preencha o endereço ao lado)'; ?></code>
        <p class="sefi-url-nota" id="sefi-url-nota"></p>
        <p class="help">Precisa abrir pela internet, senão a baixa automática não acontece. O addon manda esse endereço junto com cada boleto.</p>
      </div>
    </div>
    <button class="button is-link" name="acao" value="salvar_url"><i class="fa fa-floppy-o"></i>&nbsp; Salvar endereço</button>
  </form>
</section>

<h2>Perfis <span class="fraco">· um por banco e parceiro</span></h2>
<?php if ($perfis): ?>
<nav class="sefi-abas" aria-label="Perfis de split">
  <?php foreach ($perfis as $p): ?>
    <?php
      $pAtivo = (int) $p['ativo'] === 1;
      $pClasse = $bancos[$p['provedor']] ?? null;
      $pAtual = $sel && (int) $sel['id'] === (int) $p['id'];
    ?>
    <a class="sefi-aba<?php echo $pAtual ? ' atual' : ''; ?>" href="<?php echo h(sefi_link(['perfil' => (int) $p['id']])); ?>"<?php echo $pAtual ? ' aria-current="page"' : ''; ?>>
      <span class="sefi-aba-nome" title="<?php echo h($p['nome']); ?>"><?php echo h($p['nome']); ?></span>
      <span class="sefi-aba-sub"><?php echo h(($pClasse ? $pClasse::nome() : $p['provedor']) . ' · ' . sefi_n($porPerfil[(int) $p['id']] ?? 0, 'cliente', 'clientes')); ?></span>
      <span class="sefi-aba-selos">
        <?php if ($pAtivo): ?><span class="sefi-pill mini on"><span class="bola"></span>Ativo</span>
        <?php else: ?><span class="sefi-pill mini off"><span class="bola"></span>Desativado</span><?php endif; ?>
        <?php if ($p['ambiente'] === 'producao'): ?><span class="sefi-pill mini prod"><i class="fa fa-exclamation-triangle"></i>PRODUÇÃO</span>
        <?php else: ?><span class="sefi-pill mini homolog"><i class="fa fa-flask"></i>Teste</span><?php endif; ?>
      </span>
    </a>
  <?php endforeach; ?>
  <a class="sefi-aba novo<?php echo $novo ? ' atual' : ''; ?>" href="?novo=1#sefi-novo"><i class="fa fa-plus"></i> Novo perfil</a>
</nav>
<?php endif; ?>

<?php if ($novo): ?>
<section class="sefi-passo" id="sefi-novo">
  <div class="sefi-passo-top">
    <span class="sefi-passo-n"><i class="fa fa-plus"></i></span>
    <h3><?php echo $perfis ? 'Novo perfil' : 'Crie o primeiro perfil'; ?></h3>
  </div>
  <?php sefi_mostrar($flashes, 'perfil'); ?>
  <?php if (!$perfis): ?>
    <p class="sefi-sub">Ainda não há nenhum perfil. Um perfil liga um banco a um parceiro: escolha o banco e dê um nome fácil de reconhecer.</p>
  <?php endif; ?>
  <form method="post" autocomplete="off">
    <input type="hidden" name="csrf" value="<?php echo h($csrf); ?>">
    <?php echo sefi_campos_estado(array_merge($estado, ['perfil' => 0])); ?>
    <div class="sefi-grade">
      <div class="field">
        <label class="label" for="sefi-novo-nome">Nome do perfil</label>
        <input class="input" id="sefi-novo-nome" name="nome" maxlength="60" placeholder="Ex.: Efí – Parceiro João">
        <p class="help">Em branco, usa o nome do banco.</p>
      </div>
      <div class="field">
        <label class="label" for="sefi-novo-banco">Banco</label>
        <div class="select is-fullwidth"><select name="provedor" id="sefi-novo-banco" required>
          <?php foreach ($bancos as $chave => $bClasse): ?>
            <option value="<?php echo h($chave); ?>"><?php echo h($bClasse::nome() . ($bClasse::implementado() ? '' : ' (em construção)')); ?></option>
          <?php endforeach; ?>
        </select></div>
        <p class="help">O banco não muda depois. Para outro banco ou outro parceiro, crie outro perfil.</p>
      </div>
    </div>
    <div class="sefi-acoes">
      <button class="button is-link" name="acao" value="criar_perfil"><i class="fa fa-plus"></i>&nbsp; Criar perfil</button>
      <?php if ($perfis): ?><a href="?">Cancelar</a><?php endif; ?>
    </div>
  </form>
</section>
<?php endif; ?>

<?php if ($sel): ?>
<div id="sefi-perfil">

  <div class="sefi-perfil-head">
    <div>
      <h2><?php echo h($sel['nome']); ?></h2>
      <span class="fraco"><?php echo h($bancoNome . ' · perfil #' . $pid); ?></span>
    </div>
    <div class="sefi-selos">
      <?php if ($ativo): ?><span class="sefi-pill on"><span class="bola"></span>Ativo</span>
      <?php else: ?><span class="sefi-pill off"><span class="bola"></span>Desativado</span><?php endif; ?>
      <?php if ($producao): ?><span class="sefi-pill prod"><i class="fa fa-exclamation-triangle"></i>PRODUÇÃO – cobranças reais</span>
      <?php else: ?><span class="sefi-pill homolog"><i class="fa fa-flask"></i>Homologação (teste)</span><?php endif; ?>
    </div>
  </div>

  <?php sefi_mostrar($flashes, 'perfil'); ?>
  <?php if ($classe && !$implementado): ?>
    <div class="sefi-msg obra"><i class="fa fa-wrench"></i><div><b>Integração com o <?php echo h($bancoNome); ?> em construção</b> — dá para preencher, ainda não dá para ativar.</div></div>
  <?php endif; ?>
  <?php if ($provErro !== ''): ?>
    <div class="sefi-msg erro"><i class="fa fa-times-circle"></i><div><?php echo h($provErro); ?></div></div>
  <?php endif; ?>

  <div class="sefi-cards">
    <div class="sefi-card">
      <div class="rot"><i class="fa fa-users"></i>Clientes no perfil</div>
      <div class="num"><?php echo (int) $nClientes; ?></div>
    </div>
    <div class="sefi-card">
      <div class="rot"><i class="fa fa-file-text-o"></i>Boletos registrados</div>
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
      <div class="num"><?php echo $contaSplit ? '#' . $contaSplit : '—'; ?></div>
      <div class="det"><?php echo $contaSplit ? h($nomesContas[$contaSplit] ?? 'conta de cobrança do addon') : 'criada ao ativar'; ?></div>
    </div>
  </div>

  <form method="post" id="sefi-cfg" autocomplete="off">
    <input type="hidden" name="csrf" value="<?php echo h($csrf); ?>">
    <?php echo sefi_campos_estado($estado); ?>

    <div class="sefi-passos">
      <section class="sefi-passo">
        <div class="sefi-passo-top">
          <span class="sefi-passo-n">1</span>
          <h3>Perfil e conta de origem</h3>
        </div>
        <div class="field">
          <label class="label" for="sefi-nome">Nome do perfil</label>
          <input class="input" id="sefi-nome" name="nome" maxlength="60" value="<?php echo h($valorForm('nome', $sel['nome'])); ?>">
        </div>
        <div class="field">
          <label class="label" for="sefi-origem">Conta <?php echo h($bancoNome); ?> de origem</label>
          <?php $origemTela = (int) $valorForm('conta_origem', $origemId); ?>
          <?php if ($ativo): ?>
            <input type="hidden" name="conta_origem" value="<?php echo (int) $origemId; ?>">
          <?php endif; ?>
          <div class="select is-fullwidth"><select <?php echo $ativo ? 'disabled' : 'name="conta_origem"'; ?> id="sefi-origem">
            <option value="0">— escolha —</option>
            <?php foreach ($contas as $c): ?>
              <option value="<?php echo (int) $c['id']; ?>"<?php echo $origemTela === (int) $c['id'] ? ' selected' : ''; ?>><?php echo h((int) $c['id'] . ' - ' . $c['nome']); ?></option>
            <?php endforeach; ?>
          </select></div>
          <?php if (!$contas && $classe): ?>
            <p class="help" style="color:var(--sefi-amarelo)">Nenhuma conta <?php echo h($bancoNome); ?> cadastrada no MK-Auth. Cadastre a conta de cobrança do banco no MK-Auth primeiro.</p>
          <?php else: ?>
            <p class="help">Dela vêm multa, juros e instruções do boleto<?php echo $sel['provedor'] === 'efi' ? ', e também o Client ID/Secret da Efí' : ''; ?>. Ela não muda: os clientes saem de onde estiverem.</p>
          <?php endif; ?>
        </div>
        <div class="field">
          <label class="label" for="sefi-amb">Ambiente</label>
          <?php $ambTela = $valorForm('ambiente', $sel['ambiente']) === 'producao' ? 'producao' : 'homologacao'; ?>
          <?php if ($ativo): ?>
            <input type="hidden" name="ambiente" value="<?php echo h($sel['ambiente']); ?>">
          <?php endif; ?>
          <div class="select is-fullwidth"><select <?php echo $ativo ? 'disabled' : 'name="ambiente"'; ?> id="sefi-amb">
            <option value="homologacao"<?php echo $ambTela === 'homologacao' ? ' selected' : ''; ?>>Homologação (teste)</option>
            <option value="producao"<?php echo $ambTela === 'producao' ? ' selected' : ''; ?>>Produção (cobranças reais)</option>
          </select></div>
          <p class="sefi-aviso-prod<?php echo $ambTela === 'producao' ? ' on' : ''; ?>" id="sefi-aviso-prod"><i class="fa fa-exclamation-triangle"></i> Em produção os boletos são cobrados de verdade dos clientes.</p>
          <?php if ($ativo): ?>
            <p class="sefi-trava"><i class="fa fa-lock"></i> Para trocar a conta de origem ou o ambiente, desative o perfil primeiro.</p>
          <?php endif; ?>
        </div>
      </section>

      <section class="sefi-passo">
        <div class="sefi-passo-top">
          <span class="sefi-passo-n">2</span>
          <h3>Parceiro e repasse (<?php echo h($bancoNome); ?>)</h3>
        </div>
        <?php if (!$campos): ?>
          <p class="fraco">Este banco não tem campos para preencher.</p>
        <?php endif; ?>
        <?php foreach ($campos as $c): ?>
          <?php
            $k = (string) $c[0];
            $rot = (string) ($c[1] ?? $k);
            $tipo = (string) ($c[2] ?? 'text');
            $ajuda = (string) ($c[3] ?? '');
            $obrig = !empty($c[4]);
            $ops = is_array($c[5] ?? null) ? $c[5] : [];
            $idc = 'sefi-c-' . preg_replace('/[^A-Za-z0-9_-]/', '', $k);
            $salvo = $sel['config'][$k] ?? '';
            $salvo = is_scalar($salvo) ? (string) $salvo : '';
            $val = $tipo === 'password' ? '' : (string) $valorForm($k, $salvo);
          ?>
          <div class="field">
            <label class="label" for="<?php echo h($idc); ?>"><?php echo h($rot); ?><?php echo $obrig ? '' : ' <span class="fraco">(opcional)</span>'; ?></label>
            <?php if ($tipo === 'password'): ?>
              <input class="input" type="password" id="<?php echo h($idc); ?>" name="campo[<?php echo h($k); ?>]" value="" autocomplete="new-password" placeholder="<?php echo $salvo !== '' ? '•••• (mantém a senha salva)' : ''; ?>">
              <p class="help"><?php echo h($salvo !== '' ? 'Há uma senha salva. Deixe em branco para mantê-la.' : 'Nenhuma senha salva ainda.'); ?></p>
            <?php elseif ($tipo === 'percent'): ?>
              <input class="input" id="<?php echo h($idc); ?>" name="campo[<?php echo h($k); ?>]" inputmode="decimal" maxlength="10" value="<?php echo h(sefi_pct_tela($val)); ?>" placeholder="ex.: 10,00" data-sefi-pct="<?php echo h($idc . '-ex'); ?>">
              <?php if ($ajuda !== ''): ?><p class="help"><?php echo h($ajuda); ?></p><?php endif; ?>
              <div class="sefi-exemplo" id="<?php echo h($idc . '-ex'); ?>" aria-live="polite">Preencha o percentual para ver um exemplo.</div>
            <?php elseif ($tipo === 'select'): ?>
              <?php $lista_ops = $ops && array_keys($ops) === range(0, count($ops) - 1); ?>
              <div class="select is-fullwidth"><select id="<?php echo h($idc); ?>" name="campo[<?php echo h($k); ?>]">
                <option value="">— escolha —</option>
                <?php foreach ($ops as $ov => $ot): ?>
                  <?php $ov = $lista_ops ? (string) $ot : (string) $ov; ?>
                  <option value="<?php echo h($ov); ?>"<?php echo $ov === $val ? ' selected' : ''; ?>><?php echo h($ot); ?></option>
                <?php endforeach; ?>
              </select></div>
              <?php if ($ajuda !== ''): ?><p class="help"><?php echo h($ajuda); ?></p><?php endif; ?>
            <?php else: ?>
              <input class="input" id="<?php echo h($idc); ?>" name="campo[<?php echo h($k); ?>]" maxlength="255" spellcheck="false" value="<?php echo h($val); ?>">
              <?php if ($ajuda !== ''): ?><p class="help"><?php echo h($ajuda); ?></p><?php endif; ?>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </section>
    </div>

    <div class="sefi-acoes">
      <button class="button is-link" name="acao" value="salvar"><i class="fa fa-floppy-o"></i>&nbsp; Salvar</button>
      <?php if ($implementado): ?>
        <button class="button" name="acao" value="testar" data-salvo="1"><i class="fa fa-plug"></i>&nbsp; Testar credencial</button>
      <?php else: ?>
        <span title="A integração com o <?php echo h($bancoNome); ?> ainda está em construção."><button class="button" type="button" disabled><i class="fa fa-plug"></i>&nbsp; Testar credencial</button></span>
      <?php endif; ?>
    </div>
    <p class="sefi-acoes-nota"><b>Testar credencial</b> confere com o <?php echo h($bancoNome); ?> a credencial já salva, sem registrar nada.</p>
  </form>

  <?php if ($faltas): ?>
    <div class="sefi-pend">
      <p><i class="fa fa-list-ul"></i> <?php echo $ativo ? 'Atenção, falta:' : 'Antes de ativar, falta:'; ?></p>
      <ul>
        <?php foreach ($faltas as $f): ?>
          <li><i class="fa fa-square-o"></i><span><?php echo h($f); ?></span></li>
        <?php endforeach; ?>
      </ul>
    </div>
  <?php elseif (!$ativo && $provErro === ''): ?>
    <p class="sefi-pronto"><i class="fa fa-check-circle"></i> Tudo preenchido. Dá para ativar.</p>
  <?php endif; ?>

  <?php if ($ativo): ?>
    <form method="post" class="sefi-decisao desligar">
      <input type="hidden" name="csrf" value="<?php echo h($csrf); ?>">
      <?php echo sefi_campos_estado($estado); ?>
      <div class="sefi-decisao-txt">
        <h3>Desativar este perfil</h3>
        <p>Vai devolver <b><?php echo h(sefi_n($nClientes, 'cliente', 'clientes')); ?></b> para a conta que tinham antes. Boletos já registrados no banco continuam valendo e a baixa deles continua automática.</p>
      </div>
      <button class="button is-danger" name="acao" value="desativar" data-confirmar="<?php echo h($confDesativar); ?>"><i class="fa fa-power-off"></i>&nbsp; Desativar</button>
    </form>
  <?php else: ?>
    <form method="post" class="sefi-decisao<?php echo $podeAtivar ? '' : ' bloq'; ?>">
      <input type="hidden" name="csrf" value="<?php echo h($csrf); ?>">
      <?php echo sefi_campos_estado($estado); ?>
      <div class="sefi-decisao-txt">
        <h3>Ativar este perfil</h3>
        <p>Liga o registro com repasse. <b>Ninguém muda de conta agora</b>: depois de ativar, você escolhe os clientes na lista abaixo.</p>
        <p><?php echo $contaSplit
            ? 'Os boletos saem pela conta ' . h($nomeConta($contaSplit)) . '.'
            : 'Ao ativar, o addon cria no MK-Auth a conta de cobrança deste perfil (cópia da conta de origem, que não registra em banco nenhum).'; ?></p>
        <?php if ($producao): ?><p style="color:var(--sefi-amarelo)"><i class="fa fa-exclamation-triangle"></i> Ambiente de produção: os boletos vão ser cobranças reais.</p><?php endif; ?>
      </div>
      <?php if ($podeAtivar): ?>
        <button class="button is-success" name="acao" value="ativar" data-salvo="1" data-confirmar="<?php echo h($confAtivar); ?>"><i class="fa fa-power-off"></i>&nbsp; Ativar</button>
      <?php else: ?>
        <span title="<?php echo h(!$implementado ? 'A integração com o ' . $bancoNome . ' ainda está em construção.' : 'Complete os itens pendentes antes de ativar.'); ?>"><button class="button is-success" type="button" disabled><i class="fa fa-power-off"></i>&nbsp; Ativar</button></span>
      <?php endif; ?>
    </form>
  <?php endif; ?>

  <form method="post" class="sefi-perigo">
    <input type="hidden" name="csrf" value="<?php echo h($csrf); ?>">
    <?php echo sefi_campos_estado($estado); ?>
    <?php $podeExcluir = !$ativo && $nClientes === 0; ?>
    <p><i class="fa fa-trash-o"></i> <b>Excluir perfil.</b> <?php echo $podeExcluir
        ? 'Some da lista. A conta de cobrança dele (se existir) continua no MK-Auth.'
        : ($ativo ? 'Desative o perfil antes de excluir.' : 'Tire todos os clientes do perfil antes de excluir.'); ?></p>
    <?php if ($podeExcluir): ?>
      <button class="button is-danger is-outlined" name="acao" value="excluir" data-confirmar="<?php echo h($confExcluir); ?>">Excluir perfil</button>
    <?php else: ?>
      <button class="button is-danger is-outlined" type="button" disabled>Excluir perfil</button>
    <?php endif; ?>
  </form>

</div>

<section id="sefi-clientes">
  <h2>Clientes deste perfil</h2>
  <p class="sefi-sub">Só os clientes colocados aqui têm boleto com repasse. Ao colocar, a conta de cobrança do cliente passa a ser a do perfil; ao tirar, volta para a de antes.</p>
  <?php sefi_mostrar($flashes, 'clientes'); ?>
  <?php if (!$ativo): ?>
    <div class="sefi-msg info"><i class="fa fa-info-circle"></i><div>Este perfil está desativado. Ative-o acima para poder colocar clientes nele.</div></div>
  <?php endif; ?>

  <form method="get" class="sefi-busca" role="search">
    <input type="hidden" name="perfil" value="<?php echo (int) $pid; ?>">
    <?php if ($estado['f'] !== 'fora'): ?><input type="hidden" name="f" value="<?php echo h($estado['f']); ?>"><?php endif; ?>
    <?php if ($estado['pp'] !== SPLIT_POR_PAGINA): ?><input type="hidden" name="pp" value="<?php echo (int) $estado['pp']; ?>"><?php endif; ?>
    <input class="input" type="search" name="q" maxlength="80" value="<?php echo h($estado['q']); ?>" placeholder="Buscar por nome, login ou CPF/CNPJ" aria-label="Buscar cliente">
    <button class="button is-link" type="submit"><i class="fa fa-search"></i>&nbsp; Buscar</button>
    <?php if ($estado['q'] !== ''): ?><a href="<?php echo h(sefi_link($estado, ['q' => '', 'pg' => 1], 'sefi-clientes')); ?>">Limpar busca</a><?php endif; ?>
  </form>

  <div class="sefi-chips" aria-label="Filtro">
    <?php foreach (['fora' => 'Fora do split', 'perfil' => 'Neste perfil (' . $nClientes . ')', 'todos' => 'Todos'] as $fv => $ft): ?>
      <a class="sefi-chip<?php echo $estado['f'] === $fv ? ' on' : ''; ?>" href="<?php echo h(sefi_link($estado, ['f' => $fv, 'pg' => 1], 'sefi-clientes')); ?>"<?php echo $estado['f'] === $fv ? ' aria-current="true"' : ''; ?>><?php echo h($ft); ?></a>
    <?php endforeach; ?>
  </div>

  <form method="post" id="sefi-sel" data-ativo="<?php echo $ativo ? '1' : '0'; ?>"
        data-msg-colocar="<?php echo h($confColocar); ?>" data-msg-tirar="<?php echo h($confTirar); ?>">
    <input type="hidden" name="csrf" value="<?php echo h($csrf); ?>">
    <?php echo sefi_campos_estado($estado); ?>

    <?php
      $ini = $lista['total'] ? ($estado['pg'] - 1) * $estado['pp'] + 1 : 0;
      $fim = ($estado['pg'] - 1) * $estado['pp'] + count($lista['linhas']);
    ?>
    <div class="sefi-total-linha">
      <p class="sefi-total">
        <?php if ($lista['total']): ?>
          <?php echo h(sefi_n((int) $lista['total'], 'cliente encontrado', 'clientes encontrados')); ?><?php echo h(' · mostrando ' . $ini . '–' . $fim . ($paginas > 1 ? ' · página ' . $estado['pg'] . ' de ' . $paginas : '')); ?>
        <?php endif; ?>
      </p>
      <label class="sefi-pp">Por página
        <select id="sefi-pp" aria-label="Clientes por página">
          <?php foreach (SPLIT_POR_PAGINA_OPCOES as $opc): ?>
            <option value="<?php echo h(sefi_link($estado, ['pp' => $opc, 'pg' => 1], 'sefi-clientes')); ?>"<?php echo $opc === $estado['pp'] ? ' selected' : ''; ?>><?php echo $opc; ?></option>
          <?php endforeach; ?>
        </select>
      </label>
    </div>

    <div class="sefi-scroll">
    <?php if (!$lista['linhas']): ?>
      <div class="sefi-vazio"><i class="fa fa-users"></i>
        <?php if ($estado['q'] !== ''): ?>
          Nenhum cliente encontrado para “<?php echo h($estado['q']); ?>”<?php echo $estado['f'] !== 'todos' ? ' neste filtro. Tente o filtro “Todos”.' : '.'; ?>
        <?php elseif ($estado['f'] === 'perfil'): ?>
          Nenhum cliente neste perfil ainda. Use o filtro “Fora do split” para escolher quem entra.
        <?php elseif ($estado['f'] === 'fora'): ?>
          Todos os clientes já estão em algum perfil.
        <?php else: ?>
          Nenhum cliente cadastrado no MK-Auth.
        <?php endif; ?>
      </div>
    <?php else: ?>
      <table class="sefi-tab">
        <thead>
          <tr>
            <th class="sel"><input type="checkbox" id="sefi-todos" aria-label="Selecionar todos desta página" title="Selecionar todos desta página"></th>
            <th>Nome</th><th>Login</th><th>CPF/CNPJ</th><th>Cidade</th><th>Conta atual</th><th>Situação</th>
          </tr>
        </thead>
        <tbody>
        <?php foreach ($lista['linhas'] as $i => $c): ?>
          <?php
            $login = (string) $c['login'];
            $temSplit = $c['conta_anterior'] !== null;
            $cpid = $c['perfil_id'] === null ? 0 : (int) $c['perfil_id'];
            $aqui = $temSplit && $cpid === $pid;
            $outro = $temSplit && !$aqui;
            $outroNome = $c['perfil_nome'] !== null && $c['perfil_nome'] !== '' ? (string) $c['perfil_nome'] : ($cpid ? 'perfil #' . $cpid : 'sem perfil');
            $ckId = 'sefi-ck-' . $i;
            $contaAtual = (int) $c['conta'];
            $contaTxt = $c['conta_nome'] !== null && $c['conta_nome'] !== '' ? '#' . $contaAtual . ' – ' . $c['conta_nome'] : ($contaAtual ? '#' . $contaAtual : '—');
            $trocada = $aqui && $contaSplit && $contaAtual !== $contaSplit;
            $doc = sefi_doc($c['cpf_cnpj']);
          ?>
          <tr>
            <td class="sel">
              <input type="checkbox" class="sefi-ck" id="<?php echo h($ckId); ?>" name="logins[]" value="<?php echo h($login); ?>" data-sit="<?php echo $aqui ? 'aqui' : ($outro ? 'outro' : 'fora'); ?>"
                <?php echo $outro ? 'disabled title="' . h('Este cliente está no perfil “' . $outroNome . '”. Tire ele de lá primeiro.') . '"' : ''; ?>>
            </td>
            <td>
              <label class="nome" for="<?php echo h($ckId); ?>"><?php echo h((string) $c['nome'] !== '' ? $c['nome'] : $login); ?></label>
              <?php if (($c['cli_ativado'] ?? '') === 'n'): ?><span class="sefi-sutil">cadastro desativado no MK-Auth</span><?php endif; ?>
            </td>
            <td class="mono"><?php echo h($login); ?></td>
            <td class="mono"><?php echo $doc !== '' ? h($doc) : '<span class="fraco">—</span>'; ?></td>
            <td><?php echo (string) $c['cidade'] !== '' ? h($c['cidade']) : '<span class="fraco">—</span>'; ?></td>
            <td>
              <?php echo h($contaTxt); ?>
              <?php if ($temSplit): ?><span class="sefi-sutil">antes: <?php echo h($nomeConta($c['conta_anterior'])); ?></span><?php endif; ?>
              <?php if ($trocada): ?><span class="sefi-sutil alerta" title="A conta deste cliente foi trocada fora do addon: os boletos dele não estão saindo pela conta do split."><i class="fa fa-exclamation-triangle"></i> conta trocada à mão</span><?php endif; ?>
            </td>
            <td>
              <?php if ($aqui): ?>
                <span class="sefi-tag verde" title="Os boletos deste cliente são registrados com repasse por este perfil.">Neste perfil</span>
              <?php elseif ($outro): ?>
                <span class="sefi-tag laranja" title="Para trocar de perfil, tire o cliente do outro perfil primeiro.">Em outro perfil: <?php echo h($outroNome); ?></span>
              <?php else: ?>
                <span class="sefi-tag cinza" title="Boleto normal, sem repasse.">Fora</span>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
    </div>

    <?php if ($paginas > 1): ?>
      <nav class="sefi-pag" aria-label="Páginas">
        <?php if ($estado['pg'] > 1): ?>
          <a href="<?php echo h(sefi_link($estado, ['pg' => $estado['pg'] - 1], 'sefi-clientes')); ?>" aria-label="Página anterior">‹ Anterior</a>
        <?php endif; ?>
        <?php
          $ult = 0;
          for ($n = 1; $n <= $paginas; $n++):
            if ($n !== 1 && $n !== $paginas && abs($n - $estado['pg']) > 2) {
                continue;
            }
            if ($ult && $n - $ult > 1):
        ?>
          <span class="gap">…</span>
        <?php endif; $ult = $n; ?>
          <?php if ($n === $estado['pg']): ?>
            <span class="atual" aria-current="page"><?php echo $n; ?></span>
          <?php else: ?>
            <a href="<?php echo h(sefi_link($estado, ['pg' => $n], 'sefi-clientes')); ?>"><?php echo $n; ?></a>
          <?php endif; ?>
        <?php endfor; ?>
        <?php if ($estado['pg'] < $paginas): ?>
          <a href="<?php echo h(sefi_link($estado, ['pg' => $estado['pg'] + 1], 'sefi-clientes')); ?>" aria-label="Próxima página">Próxima ›</a>
        <?php endif; ?>
      </nav>
    <?php endif; ?>

    <?php if ($lista['linhas']): ?>
      <div class="sefi-acaobar">
        <div class="sefi-acaobar-txt">
          <b id="sefi-n">Marque os clientes na lista</b>
          <span><?php echo $ativo ? 'A seleção vale só para esta página (até ' . $estado['pp'] . ' por vez).' : 'Ative o perfil para colocar clientes nele.'; ?></span>
        </div>
        <div class="sefi-acaobar-bts">
          <?php if ($ativo): ?>
            <button class="button is-success" id="sefi-b-colocar" name="acao" value="colocar"><i class="fa fa-sign-in"></i>&nbsp; Colocar no split</button>
          <?php else: ?>
            <span title="Ative o perfil para colocar clientes nele."><button class="button is-success" type="button" disabled><i class="fa fa-sign-in"></i>&nbsp; Colocar no split</button></span>
          <?php endif; ?>
          <button class="button" id="sefi-b-tirar" name="acao" value="tirar"><i class="fa fa-sign-out"></i>&nbsp; Tirar do split</button>
        </div>
      </div>
    <?php endif; ?>
  </form>
</section>

<h2>Últimos boletos deste perfil</h2>
<div class="sefi-scroll">
<?php if (!$titulos): ?>
  <div class="sefi-vazio"><i class="fa fa-inbox"></i>Nenhum boleto registrado ainda. Depois de ativar e colocar clientes, os boletos novos deles aparecem aqui em até 5 minutos.</div>
<?php else: ?>
  <table class="sefi-tab">
    <thead>
      <tr><th>Título</th><th>Cliente</th><th>Valor</th><th>Vencimento</th><th>Situação</th><th>Tentativas</th><th>Id no <?php echo h($bancoNome); ?></th><th>Erro</th><th>Atualizado</th></tr>
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
<?php endif; ?>

<h2>Registro <span class="fraco">· todos os perfis</span></h2>
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
  function porId(id) { return document.getElementById(id); }
  function cada(lista, fn) { for (var i = 0; i < lista.length; i++) { fn(lista[i], i); } }

  // Confirmações e aviso de campos não salvos (Testar e Ativar usam o que já está salvo).
  var cfg = porId('sefi-cfg');
  function estadoForm(f) {
    var partes = [];
    cada(f.querySelectorAll('input[name], select[name]'), function (el) {
      if (el.type !== 'hidden') { partes.push(el.name + '=' + el.value); }
    });
    return partes.join('&');
  }
  var inicial = cfg ? estadoForm(cfg) : '';
  cada(document.querySelectorAll('.sefi [data-confirmar], .sefi [data-salvo]'), function (b) {
    b.addEventListener('click', function (ev) {
      if (b.getAttribute('data-salvo') && cfg && estadoForm(cfg) !== inicial) {
        if (!confirm('Você mudou campos e ainda não salvou. Esta ação usa a configuração salva.\n\nContinuar mesmo assim?')) {
          ev.preventDefault();
          return;
        }
      }
      var msg = b.getAttribute('data-confirmar');
      if (msg && !confirm(msg)) { ev.preventDefault(); }
    });
  });

  // Aviso de produção
  var amb = porId('sefi-amb');
  var avisoProd = porId('sefi-aviso-prod');
  if (amb && avisoProd) {
    amb.addEventListener('change', function () {
      avisoProd.className = 'sefi-aviso-prod' + (amb.value === 'producao' ? ' on' : '');
    });
  }

  // Exemplo de cada campo de percentual
  function reais(centavos) {
    var s = (centavos / 100).toFixed(2).split('.');
    return 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }
  function exemplo(pct, ex) {
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
  cada(document.querySelectorAll('.sefi input[data-sefi-pct]'), function (pct) {
    var ex = porId(pct.getAttribute('data-sefi-pct'));
    if (!ex) { return; }
    pct.addEventListener('input', function () { exemplo(pct, ex); });
    exemplo(pct, ex);
  });

  // Prévia do endereço de aviso
  var url = porId('sefi-url');
  var prev = porId('sefi-url-prev');
  var nota = porId('sefi-url-nota');
  var caminho = <?php echo json_encode(SEFI_CAMINHO_RETORNO . '?p=…&t=••••••', JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP); ?>;
  function atualizaUrl() {
    var v = url.value.trim();
    nota.textContent = '';
    if (v === '') { prev.textContent = '(preencha o endereço ao lado)'; return; }
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
    } else if (m[1].toLowerCase() === 'http') {
      nota.textContent = 'Se o MK-Auth tiver https, prefira https://';
    }
  }
  if (url && prev && nota) { url.addEventListener('input', atualizaUrl); atualizaUrl(); }

  // Clientes por página: troca de página na hora.
  var pp = porId('sefi-pp');
  if (pp) { pp.addEventListener('change', function () { window.location.href = pp.value; }); }

  // Seleção de clientes
  var sel = porId('sefi-sel');
  if (!sel) { return; }
  var cks = sel.querySelectorAll('input.sefi-ck');
  var todos = porId('sefi-todos');
  var nEl = porId('sefi-n');
  var bCol = porId('sefi-b-colocar');
  var bTir = porId('sefi-b-tirar');
  var conta = { fora: 0, aqui: 0 };

  function plural(n) { return n === 1 ? '1 cliente' : n + ' clientes'; }
  function atualiza() {
    var hab = 0, marc = 0;
    conta = { fora: 0, aqui: 0 };
    cada(cks, function (ck) {
      var tr = ck.closest ? ck.closest('tr') : null;
      if (!ck.disabled) { hab++; }
      if (ck.checked && !ck.disabled) {
        marc++;
        if (ck.getAttribute('data-sit') === 'aqui') { conta.aqui++; } else { conta.fora++; }
      }
      if (tr) { tr.className = ck.checked && !ck.disabled ? 'marcado' : ''; }
    });
    if (nEl) {
      nEl.textContent = marc === 0 ? 'Nenhum cliente marcado' : (marc === 1 ? '1 selecionado' : marc + ' selecionados');
    }
    if (bCol) {
      bCol.disabled = conta.fora === 0;
      bCol.title = conta.fora === 0 ? 'Marque clientes que estão fora do split.' : '';
    }
    if (bTir) {
      bTir.disabled = conta.aqui === 0;
      bTir.title = conta.aqui === 0 ? 'Marque clientes que estão neste perfil.' : '';
    }
    if (todos) {
      todos.disabled = hab === 0;
      todos.checked = hab > 0 && marc === hab;
      todos.indeterminate = marc > 0 && marc < hab;
    }
  }
  cada(cks, function (ck) { ck.addEventListener('change', atualiza); });
  if (todos) {
    todos.addEventListener('change', function () {
      cada(cks, function (ck) { if (!ck.disabled) { ck.checked = todos.checked; } });
      atualiza();
    });
  }
  function confirmar(b, attr, n) {
    b.addEventListener('click', function (ev) {
      var msg = (sel.getAttribute(attr) || '').replace('{n}', plural(n()));
      if (msg && !confirm(msg)) { ev.preventDefault(); }
    });
  }
  if (bCol) { confirmar(bCol, 'data-msg-colocar', function () { return conta.fora; }); }
  if (bTir) { confirmar(bTir, 'data-msg-tirar', function () { return conta.aqui; }); }

  // Manda os marcados num campo só (um login por linha). Com 1500 checkboxes,
  // logins[] passaria do limite de campos do PHP (max_input_vars).
  sel.addEventListener('submit', function () {
    var lista = [];
    cada(cks, function (ck) {
      if (ck.checked && !ck.disabled) { lista.push(ck.value); }
      ck.disabled = true; // não vai como logins[]
    });
    var campo = document.createElement('input');
    campo.type = 'hidden';
    campo.name = 'logins_lista';
    campo.value = lista.join('\n');
    sel.appendChild(campo);
  });
  // Se o navegador voltar para esta página pelo histórico, reabilita os checkboxes.
  window.addEventListener('pageshow', function () {
    cada(cks, function (ck) { ck.disabled = ck.getAttribute('data-sit') === 'outro'; });
    atualiza();
  });
  atualiza();
})();
</script>

<?php include('../../baixo.php'); ?>
<script src="../../menu.js.hhvm"></script>
</body>
</html>
