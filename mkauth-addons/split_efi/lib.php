<?php
/**
 * Addon de SPLIT DE PAGAMENTO para o MK-Auth.
 *
 * O MK-Auth registra boletos no banco pelo código interno dele, sem split. Este
 * addon trabalha com PERFIS: cada perfil liga um banco (provedor: Efí, Sicoob...)
 * a uma conta de cobrança própria no sis_boleto, com gateway 'fat' (o MK-Auth
 * gera o título mas não registra em banco nenhum). Os clientes são escolhidos
 * À MÃO na tela: ao colocar um cliente no perfil, a conta dele vira a conta do
 * perfil (a anterior fica guardada para desfazer). O cron registra cada título
 * novo dessas contas no banco já com o repasse para o parceiro, e o retorno.php
 * dá a baixa quando o banco avisa o pagamento.
 *
 * Só funções aqui. Quem usa: index.php (painel), cron.php e retorno.php.
 */

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    http_response_code(404);
    exit;
}

// conexao.php fica em /opt/mk-auth/include (include_path do MK-Auth, web e CLI).
include_once('conexao.php');
require_once __DIR__ . '/provedores/Provedor.php';
require_once __DIR__ . '/provedores/efi.php';
require_once __DIR__ . '/provedores/sicoob.php';

const SPLIT_COLETOR = 'addon.split';   // diferente de 'url.retorno': mostra quem deu a baixa
const SPLIT_MAX_TENTATIVAS = 5;
const SPLIT_LOTE = 50;                  // títulos por rodada do cron, por perfil
const SPLIT_POR_PAGINA = 100;           // clientes por página na seleção (padrão)
const SPLIT_POR_PAGINA_OPCOES = [100, 500, 1500];
// O MK-Auth atrela ao título (sis_mlanc) uma linha por serviço adicional do
// contrato (sis_sercontratos), com este começo de descrição. É isso que vai
// para o parceiro; a mensalidade fica toda na conta que emite o boleto.
const SPLIT_PREFIXO_ADICIONAL = 'Valor adicional';

/** Bancos que o addon conhece: chave => classe. */
function provedores_disponiveis(): array
{
    return ['efi' => 'ProvedorEfi', 'sicoob' => 'ProvedorSicoob'];
}

// ---------------------------------------------------------------- banco de dados

function db(): mysqli
{
    global $LOADMYSQL;
    if (!($LOADMYSQL instanceof mysqli)) {
        throw new RuntimeException('Sem conexão com o banco do MK-Auth.');
    }
    return $LOADMYSQL;
}

/** Executa com parâmetros. SELECT devolve linhas; o resto devolve linhas afetadas. */
function q(string $sql, array $params = [])
{
    $st = db()->prepare($sql);
    if (!$st) {
        throw new RuntimeException('SQL: ' . db()->error);
    }
    if ($params) {
        $tipos = '';
        foreach ($params as $p) {
            $tipos .= is_int($p) ? 'i' : (is_float($p) ? 'd' : 's');
        }
        $st->bind_param($tipos, ...$params);
    }
    if (!$st->execute()) {
        $erro = $st->error;
        $st->close();
        throw new RuntimeException('SQL: ' . $erro);
    }
    $res = $st->get_result();
    if ($res === false) {
        $n = $st->affected_rows;
        $st->close();
        return $n;
    }
    $linhas = $res->fetch_all(MYSQLI_ASSOC);
    $st->close();
    return $linhas;
}

function q1(string $sql, array $params = []): ?array
{
    $r = q($sql, $params);
    return $r[0] ?? null;
}

function coluna_existe(string $tabela, string $coluna): bool
{
    return (bool) q1("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [$tabela, $coluna]);
}

function garantir_tabelas(): void
{
    db()->query("CREATE TABLE IF NOT EXISTS addon_split_config (
        chave VARCHAR(64) NOT NULL PRIMARY KEY,
        valor TEXT NULL
    ) DEFAULT CHARSET=utf8");

    // Um perfil por banco/parceiro. config = JSON com os campos do provedor.
    db()->query("CREATE TABLE IF NOT EXISTS addon_split_perfis (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(60) NOT NULL,
        provedor VARCHAR(20) NOT NULL,
        conta_origem INT NULL,
        conta_split INT NULL,
        ambiente VARCHAR(12) NOT NULL DEFAULT 'homologacao',
        ativo TINYINT(1) NOT NULL DEFAULT 0,
        config TEXT NULL,
        criado_em DATETIME NOT NULL,
        atualizado_em DATETIME NOT NULL
    ) DEFAULT CHARSET=utf8");

    // Clientes escolhidos à mão para um perfil, com a conta que tinham antes.
    db()->query("CREATE TABLE IF NOT EXISTS addon_split_clientes (
        login VARCHAR(64) NOT NULL PRIMARY KEY,
        perfil_id INT NULL,
        conta_anterior VARCHAR(11) NOT NULL,
        movido_em DATETIME NOT NULL
    ) DEFAULT CHARSET=utf8");

    // Um registro por título do sis_lanc que o addon tentou registrar.
    // charge_id = id da cobrança no banco (qualquer provedor).
    db()->query("CREATE TABLE IF NOT EXISTS addon_split_titulos (
        id_lanc INT NOT NULL PRIMARY KEY,
        perfil_id INT NULL,
        charge_id VARCHAR(64) NULL,
        situacao VARCHAR(20) NOT NULL,
        valor DECIMAL(12,2) NULL,
        vencimento DATE NULL,
        percentual INT NULL,
        payee_code VARCHAR(64) NULL,
        link VARCHAR(255) NULL,
        tentativas INT NOT NULL DEFAULT 0,
        erro TEXT NULL,
        criado_em DATETIME NOT NULL,
        atualizado_em DATETIME NOT NULL,
        KEY k_charge (charge_id),
        KEY k_situacao (situacao)
    ) DEFAULT CHARSET=utf8");

    db()->query("CREATE TABLE IF NOT EXISTS addon_split_log (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        data DATETIME NOT NULL,
        nivel VARCHAR(10) NOT NULL,
        mensagem TEXT NOT NULL,
        KEY k_data (data)
    ) DEFAULT CHARSET=utf8");

    // Instalações da versão 0.1 (um perfil só, sem perfil_id).
    if (!coluna_existe('addon_split_clientes', 'perfil_id')) {
        db()->query("ALTER TABLE addon_split_clientes ADD perfil_id INT NULL AFTER login");
    }
    if (!coluna_existe('addon_split_titulos', 'perfil_id')) {
        db()->query("ALTER TABLE addon_split_titulos ADD perfil_id INT NULL AFTER id_lanc");
        db()->query("ALTER TABLE addon_split_titulos MODIFY charge_id VARCHAR(64) NULL");
    }
    // Repasse em reais (soma dos serviços adicionais). NULL = registrado pela
    // regra antiga, de percentual: o sincronizar() refaz esses boletos.
    if (!coluna_existe('addon_split_titulos', 'valor_repasse')) {
        db()->query("ALTER TABLE addon_split_titulos ADD valor_repasse DECIMAL(12,2) NULL AFTER valor");
    }
    migrar_config_antiga();
}

/** A 0.1 guardava um perfil Efí só em addon_split_config. Vira o perfil 1. */
function migrar_config_antiga(): void
{
    if (q1("SELECT id FROM addon_split_perfis LIMIT 1") || cfg('conta_origem') === null) {
        return;
    }
    $agora = date('Y-m-d H:i:s');
    q("INSERT INTO addon_split_perfis (nome, provedor, conta_origem, conta_split, ambiente, ativo, config, criado_em, atualizado_em)
       VALUES ('Efí', 'efi', ?, ?, ?, ?, ?, ?, ?)", [
        (int) cfg('conta_origem', '0') ?: null,
        (int) cfg('conta_split', '0') ?: null,
        cfg('ambiente', 'homologacao') === 'producao' ? 'producao' : 'homologacao',
        cfg('ativo', '0') === '1' ? 1 : 0,
        json_encode(['payee_code' => (string) cfg('payee_code', ''), 'percentual' => (string) cfg('percentual', '')]),
        $agora, $agora,
    ]);
    $id = (int) db()->insert_id;
    q("UPDATE addon_split_clientes SET perfil_id = ? WHERE perfil_id IS NULL", [$id]);
    q("UPDATE addon_split_titulos SET perfil_id = ? WHERE perfil_id IS NULL", [$id]);
    foreach (['conta_origem', 'conta_split', 'ambiente', 'ativo', 'payee_code', 'percentual'] as $c) {
        q("DELETE FROM addon_split_config WHERE chave = ?", [$c]);
    }
    log_split('info', "Configuração da versão anterior virou o perfil $id (Efí).");
}

function cfg(string $chave, ?string $padrao = null): ?string
{
    $r = q1("SELECT valor FROM addon_split_config WHERE chave = ?", [$chave]);
    return $r === null ? $padrao : $r['valor'];
}

function cfg_set(string $chave, ?string $valor): void
{
    q("INSERT INTO addon_split_config (chave, valor) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)", [$chave, $valor]);
}

function log_split(string $nivel, string $mensagem): void
{
    q("INSERT INTO addon_split_log (data, nivel, mensagem) VALUES (NOW(), ?, ?)", [$nivel, $mensagem]);
    if (PHP_SAPI === 'cli') {
        echo date('Y-m-d H:i:s') . " [$nivel] $mensagem\n";
    }
}

function uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return strtoupper(vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4)));
}

// ---------------------------------------------------------------- configuração geral

/** Endereço público do MK-Auth, só esquema://host[:porta]. */
function url_base(): string
{
    return rtrim((string) cfg('url_base', ''), '/');
}

function token_retorno(): string
{
    $t = (string) cfg('token_retorno', '');
    if ($t === '') {
        $t = bin2hex(random_bytes(24));
        cfg_set('token_retorno', $t);
    }
    return $t;
}

function url_retorno(int $perfilId): string
{
    return url_base() . '/admin/addons/split_efi/retorno.php?p=' . $perfilId . '&t=' . rawurlencode(token_retorno());
}

// ---------------------------------------------------------------- perfis

function perfis(): array
{
    return array_map('perfil_decodificar', q("SELECT * FROM addon_split_perfis ORDER BY id"));
}

function perfil(int $id): ?array
{
    $p = q1("SELECT * FROM addon_split_perfis WHERE id = ?", [$id]);
    return $p ? perfil_decodificar($p) : null;
}

function perfil_decodificar(array $p): array
{
    $p['config'] = json_decode((string) ($p['config'] ?? ''), true) ?: [];
    return $p;
}

function conta(int $id): ?array
{
    return $id ? q1("SELECT * FROM sis_boleto WHERE id = ?", [$id]) : null;
}

function provedor(array $perfil): Provedor
{
    $classe = provedores_disponiveis()[$perfil['provedor']] ?? null;
    if (!$classe) {
        throw new RuntimeException("Banco desconhecido: {$perfil['provedor']}.");
    }
    return new $classe($perfil, conta((int) $perfil['conta_origem']));
}

/** Contas do MK-Auth que servem de origem para o banco do perfil. */
function contas_origem(string $provedor): array
{
    $classe = provedores_disponiveis()[$provedor] ?? null;
    if (!$classe) {
        return [];
    }
    return q("SELECT id, nome FROM sis_boleto WHERE (" . $classe::filtroContasOrigem() . ")
                AND (delconta IS NULL OR delconta <> 's') ORDER BY id");
}

/** O que falta para o perfil poder ser ativado. Vazio = pronto. */
function pendencias_perfil(array $perfil): array
{
    $f = provedor($perfil)->pendencias();
    if (!preg_match('#^https?://#', url_base())) {
        $f[] = 'Informe o endereço público do MK-Auth (para o banco avisar o pagamento).';
    }
    return $f;
}

/**
 * Cria ou atualiza um perfil. $dados: nome, provedor, conta_origem, ambiente e
 * os campos do provedor. Campo 'password' em branco mantém o valor salvo.
 */
function salvar_perfil(?int $id, array $dados): int
{
    $atual = $id ? perfil($id) : null;
    if ($id && !$atual) {
        throw new RuntimeException('Perfil não encontrado.');
    }
    $provedor = $atual ? $atual['provedor'] : (string) ($dados['provedor'] ?? '');
    $classe = provedores_disponiveis()[$provedor] ?? null;
    if (!$classe) {
        throw new RuntimeException('Escolha o banco do perfil.');
    }
    $nome = trim((string) ($dados['nome'] ?? '')) ?: $classe::nome();
    $origem = (int) ($dados['conta_origem'] ?? 0);
    if ($origem && !in_array($origem, array_map('intval', array_column(contas_origem($provedor), 'id')), true)) {
        throw new RuntimeException('Conta de origem inválida para este banco.');
    }
    if ($atual && (int) $atual['ativo'] === 1 && $origem !== (int) $atual['conta_origem']) {
        throw new RuntimeException('Desative o perfil antes de trocar a conta de origem.');
    }
    $ambiente = ($dados['ambiente'] ?? '') === 'producao' ? 'producao' : 'homologacao';
    // Trocar de ambiente com o perfil ativo faria o cron cancelar cobranças de
    // homologação usando a credencial de produção (e vice-versa).
    if ($atual && (int) $atual['ativo'] === 1 && $ambiente !== $atual['ambiente']) {
        throw new RuntimeException('Desative o perfil antes de trocar o ambiente.');
    }

    $config = $atual['config'] ?? [];
    foreach ($classe::campos() as [$chave, $rotulo, $tipo]) {
        $v = trim((string) ($dados[$chave] ?? ''));
        if ($tipo === 'password' && $v === '') {
            continue; // em branco = mantém
        }
        if ($tipo === 'percent' && $v !== '') {
            $v = str_replace([',', '%', ' '], ['.', '', ''], $v);
            if (!is_numeric($v)) {
                throw new RuntimeException("$rotulo: use só números, por exemplo 10 ou 10,5.");
            }
            $v = number_format((float) $v, 2, '.', '');
        }
        $config[$chave] = mb_substr($v, 0, 255);
    }

    $agora = date('Y-m-d H:i:s');
    $json = json_encode($config, JSON_UNESCAPED_UNICODE);
    if ($atual) {
        q("UPDATE addon_split_perfis SET nome = ?, conta_origem = ?, ambiente = ?, config = ?, atualizado_em = ? WHERE id = ?",
          [mb_substr($nome, 0, 60), $origem ?: null, $ambiente, $json, $agora, $id]);
        return $id;
    }
    q("INSERT INTO addon_split_perfis (nome, provedor, conta_origem, ambiente, ativo, config, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)", [mb_substr($nome, 0, 60), $provedor, $origem ?: null, $ambiente, $json, $agora, $agora]);
    $novo = (int) db()->insert_id;
    log_split('info', "Perfil $novo ($nome, {$classe::nome()}) criado.");
    return $novo;
}

/** Apaga um perfil sem clientes e desativado. */
function excluir_perfil(int $id): void
{
    $p = perfil($id);
    if (!$p) {
        throw new RuntimeException('Perfil não encontrado.');
    }
    if ((int) $p['ativo'] === 1) {
        throw new RuntimeException('Desative o perfil antes de excluir.');
    }
    if (q1("SELECT login FROM addon_split_clientes WHERE perfil_id = ? LIMIT 1", [$id])) {
        throw new RuntimeException('Tire todos os clientes do perfil antes de excluir.');
    }
    q("DELETE FROM addon_split_perfis WHERE id = ?", [$id]);
    log_split('info', "Perfil $id ({$p['nome']}) excluído. A conta de cobrança {$p['conta_split']} continua no MK-Auth.");
}

/**
 * Cria (uma vez) a conta de cobrança do perfil, copiando a conta de origem com
 * gateway 'fat': o MK-Auth gera o título, mas não registra em banco nenhum.
 */
function garantir_conta_split(array $perfil): int
{
    $id = (int) $perfil['conta_split'];
    if ($id && conta($id)) {
        return $id;
    }
    $origem = conta((int) $perfil['conta_origem']);
    if (!$origem) {
        throw new RuntimeException('Conta de origem não configurada.');
    }
    $nova = $origem;
    unset($nova['id']);
    $nova['uuid_boleto'] = uuid4();
    $nova['nome'] = mb_substr('SPLIT ' . mb_strtoupper($perfil['nome']) . ' (ADDON)', 0, 50);
    $nova['utilizar'] = 'fatura';
    $nova['banco'] = 'proprio.php';
    $nova['gateway'] = 'fat';
    $nova['calc_boleto'] = 'nao';   // senão o MK-Auth recalcula a linha digitável
    $nova['delconta'] = 'n';
    // Credenciais ficam só na conta de origem: a conta nova não fala com banco nenhum.
    foreach (['cliente_id_gnet', 'cliente_secret_gnet', 'cliente_id_teste_gnet', 'cliente_secret_teste_gnet',
              'token_gnet', 'id_conta_gnet', 'url_gnet', 'token_juno', 'token_sjuno', 'galax_id', 'galax_hash',
              'galax_tokenwebhook', 'iugu_token', 'token', 'token_bcash', 'token_pagseguro'] as $c) {
        if (array_key_exists($c, $nova)) {
            $nova[$c] = null;
        }
    }
    $cols = array_keys($nova);
    $sql = 'INSERT INTO sis_boleto (`' . implode('`,`', $cols) . '`) VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
    $vals = array_map(fn($v) => $v === null ? null : (string) $v, array_values($nova));
    $st = db()->prepare($sql);
    $st->bind_param(str_repeat('s', count($vals)), ...$vals);
    if (!$st->execute()) {
        throw new RuntimeException('Não criei a conta do split: ' . $st->error);
    }
    $id = (int) db()->insert_id;
    $st->close();
    q("UPDATE addon_split_perfis SET conta_split = ?, atualizado_em = NOW() WHERE id = ?", [$id, (int) $perfil['id']]);
    log_split('info', "Conta de cobrança $id criada para o perfil {$perfil['id']} (cópia da conta {$origem['id']}, gateway fat).");
    return $id;
}

/** Liga o registro com split do perfil. Não move nenhum cliente. */
function ativar_perfil(int $id): void
{
    $p = perfil($id);
    if (!$p) {
        throw new RuntimeException('Perfil não encontrado.');
    }
    $prov = provedor($p);
    if (!$prov::implementado()) {
        throw new RuntimeException('A integração com o ' . $prov::nome() . ' ainda não foi escrita.');
    }
    $faltas = pendencias_perfil($p);
    if ($faltas) {
        throw new RuntimeException(implode(' ', $faltas));
    }
    $prov->testar();
    garantir_conta_split($p);
    q("UPDATE addon_split_perfis SET ativo = 1, atualizado_em = NOW() WHERE id = ?", [$id]);
    log_split('info', "Perfil $id ({$p['nome']}) ativado.");
}

/**
 * Desliga o perfil. Os clientes dele voltam para a conta anterior: se ficassem
 * na conta 'fat', o MK-Auth geraria títulos sem registro em banco nenhum.
 * O que já está no banco continua valendo e o retorno continua dando baixa.
 */
function desativar_perfil(int $id): int
{
    $logins = array_column(q("SELECT login FROM addon_split_clientes WHERE perfil_id = ?", [$id]), 'login');
    $n = $logins ? tirar_do_split($logins) : 0;
    q("UPDATE addon_split_perfis SET ativo = 0, atualizado_em = NOW() WHERE id = ?", [$id]);
    log_split('info', "Perfil $id desativado. $n cliente(s) voltaram para a conta anterior.");
    return $n;
}

// ---------------------------------------------------------------- clientes (seleção manual)

/**
 * Lista clientes para a tela de seleção.
 * $filtro: todos | fora (fora de qualquer split) | perfil (só os do perfil $perfilId).
 * Devolve ['linhas' => [...], 'total' => n].
 */
function listar_clientes(string $busca, string $filtro, int $perfilId, int $pagina, int $porPagina = SPLIT_POR_PAGINA): array
{
    if (!in_array($porPagina, SPLIT_POR_PAGINA_OPCOES, true)) {
        $porPagina = SPLIT_POR_PAGINA;
    }
    $onde = ['1=1'];
    $par = [];
    $busca = trim($busca);
    if ($busca !== '') {
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $busca) . '%';
        $dig = preg_replace('/\D/', '', $busca);
        $cond = 'c.nome LIKE ? OR c.login LIKE ?';
        $par[] = $like;
        $par[] = $like;
        if (strlen($dig) >= 3) {
            $cond .= " OR REPLACE(REPLACE(REPLACE(c.cpf_cnpj, '.', ''), '-', ''), '/', '') LIKE ?";
            $par[] = '%' . $dig . '%';
        }
        $onde[] = "($cond)";
    }
    if ($filtro === 'fora') {
        $onde[] = 's.login IS NULL';
    } elseif ($filtro === 'perfil') {
        $onde[] = 's.perfil_id = ?';
        $par[] = $perfilId;
    }
    $where = implode(' AND ', $onde);
    $total = (int) (q1("SELECT COUNT(*) n FROM sis_cliente c LEFT JOIN addon_split_clientes s ON s.login = c.login WHERE $where", $par)['n'] ?? 0);
    $off = max(0, $pagina - 1) * $porPagina;
    $linhas = q("SELECT c.login, c.nome, c.cpf_cnpj, c.cidade, c.cli_ativado, c.conta,
                        b.nome AS conta_nome, s.perfil_id, p.nome AS perfil_nome, s.conta_anterior
                   FROM sis_cliente c
              LEFT JOIN addon_split_clientes s ON s.login = c.login
              LEFT JOIN addon_split_perfis p ON p.id = s.perfil_id
              LEFT JOIN sis_boleto b ON b.id = c.conta
                  WHERE $where
               ORDER BY c.nome
                  LIMIT $porPagina OFFSET $off", $par);
    return ['linhas' => $linhas, 'total' => $total];
}

/**
 * Coloca os clientes escolhidos no perfil: guarda a conta atual e troca para a
 * conta do split. Só com o perfil ativo (senão os títulos ficariam sem registro).
 * Devolve [movidos, ignorados (já em outro perfil)].
 */
function colocar_no_split(int $perfilId, array $logins): array
{
    $p = perfil($perfilId);
    if (!$p) {
        throw new RuntimeException('Perfil não encontrado.');
    }
    if ((int) $p['ativo'] !== 1 || !(int) $p['conta_split']) {
        throw new RuntimeException('Ative o perfil antes de colocar clientes nele.');
    }
    $split = (string) (int) $p['conta_split'];
    $movidos = 0;
    $ignorados = [];
    foreach (array_unique(array_map('strval', $logins)) as $login) {
        $cli = q1("SELECT login, conta FROM sis_cliente WHERE login = ?", [$login]);
        if (!$cli) {
            continue;
        }
        $ja = q1("SELECT perfil_id FROM addon_split_clientes WHERE login = ?", [$login]);
        if ($ja) {
            if ((int) $ja['perfil_id'] !== $perfilId) {
                $ignorados[] = $login;
            }
            continue;
        }
        db()->begin_transaction();
        try {
            q("INSERT INTO addon_split_clientes (login, perfil_id, conta_anterior, movido_em) VALUES (?, ?, ?, NOW())",
              [$login, $perfilId, (string) $cli['conta']]);
            q("UPDATE sis_cliente SET conta = ? WHERE login = ?", [$split, $login]);
            db()->commit();
        } catch (Throwable $e) {
            db()->rollback();
            throw $e;
        }
        $movidos++;
    }
    if ($movidos) {
        log_split('info', "$movidos cliente(s) colocados no perfil $perfilId ({$p['nome']}), conta $split.");
    }
    return [$movidos, $ignorados];
}

/** Devolve os clientes à conta que tinham antes. Devolve quantos voltaram. */
function tirar_do_split(array $logins): int
{
    $n = 0;
    foreach (array_unique(array_map('strval', $logins)) as $login) {
        $s = q1("SELECT s.conta_anterior, p.conta_split FROM addon_split_clientes s
                  LEFT JOIN addon_split_perfis p ON p.id = s.perfil_id WHERE s.login = ?", [$login]);
        if (!$s) {
            continue;
        }
        // Só devolve se o cliente ainda está na conta do split (alguém pode ter mudado à mão).
        db()->begin_transaction();
        try {
            q("UPDATE sis_cliente SET conta = ? WHERE login = ? AND conta = ?",
              [(string) $s['conta_anterior'], $login, (string) (int) $s['conta_split']]);
            q("DELETE FROM addon_split_clientes WHERE login = ?", [$login]);
            db()->commit();
        } catch (Throwable $e) {
            db()->rollback();
            throw $e;
        }
        $n++;
    }
    if ($n) {
        log_split('info', "$n cliente(s) tirados do split e devolvidos à conta anterior.");
    }
    return $n;
}

// ---------------------------------------------------------------- registro dos títulos

/**
 * Como o título se divide. Os atrelados do sis_mlanc entram como a tela do
 * MK-Auth soma (desconto subtrai):
 * - adicionais: as linhas "Valor adicional: ..." — vão inteiras para o parceiro;
 * - empresa: sis_lanc.valor + os outros atrelados - descontos — fica na conta
 *   que emite o boleto.
 * Devolve ['empresa' => float, 'adicionais' => [['desc' => ..., 'valor' => float]], 'repasse' => float, 'total' => float].
 */
function composicao_titulo(array $t): array
{
    $empresa = (float) $t['valor'];
    $adicionais = [];
    $repasse = 0.0;
    $linhas = q("SELECT valor, tipo, `desc` AS descricao FROM sis_mlanc
                  WHERE idlanc = ? AND (deltitulo = 0 OR deltitulo IS NULL) ORDER BY id", [(int) $t['id']]);
    foreach ($linhas as $m) {
        $v = round((float) $m['valor'], 2);
        $desc = trim((string) $m['descricao']);
        if ($m['tipo'] === 'desconto') {
            $empresa -= $v;
        } elseif ($v > 0 && stripos($desc, SPLIT_PREFIXO_ADICIONAL) === 0) {
            $adicionais[] = ['desc' => $desc, 'valor' => $v];
            $repasse += $v;
        } else {
            $empresa += $v;
        }
    }
    $empresa = round($empresa, 2);
    $repasse = round($repasse, 2);
    return ['empresa' => $empresa, 'adicionais' => $adicionais, 'repasse' => $repasse, 'total' => round($empresa + $repasse, 2)];
}

function registrar_titulo(array $perfil, Provedor $prov, array $t): void
{
    $agora = date('Y-m-d H:i:s');
    $venc = substr((string) $t['datavenc'], 0, 10);
    $comp = composicao_titulo($t);
    $t['composicao'] = $comp;
    try {
        if ($comp['empresa'] < 0) {
            throw new RuntimeException('Os descontos do título passam do valor da mensalidade.');
        }
        $cli = q1("SELECT nome, cpf_cnpj, celular, fone, email, endereco, numero, bairro, cidade, estado, cep, complemento
                     FROM sis_cliente WHERE login = ?", [$t['login']]);
        if (!$cli) {
            throw new RuntimeException('Cliente não encontrado no sis_cliente.');
        }
        $r = $prov->registrar($t, $cli, url_retorno((int) $perfil['id']));
        $cols = $r['sis_lanc'] ?? [];
        if ($cols) {
            $sets = implode(', ', array_map(fn($c) => "`$c` = ?", array_keys($cols)));
            q("UPDATE sis_lanc SET $sets WHERE id = ?", array_merge(array_values($cols), [(int) $t['id']]));
        }
        $fmt = fn($v) => number_format((float) $v, 2, '.', '');
        q("INSERT INTO addon_split_titulos (id_lanc, perfil_id, charge_id, situacao, valor, valor_repasse, vencimento, percentual, payee_code, link, tentativas, erro, criado_em, atualizado_em)
           VALUES (?, ?, ?, 'registrado', ?, ?, ?, NULL, ?, ?, 1, NULL, ?, ?)
           ON DUPLICATE KEY UPDATE perfil_id = VALUES(perfil_id), charge_id = VALUES(charge_id), situacao = 'registrado',
             valor = VALUES(valor), valor_repasse = VALUES(valor_repasse), vencimento = VALUES(vencimento), percentual = NULL,
             payee_code = VALUES(payee_code), link = VALUES(link), tentativas = tentativas + 1, erro = NULL,
             atualizado_em = VALUES(atualizado_em)",
          [(int) $t['id'], (int) $perfil['id'], (string) $r['id'], $fmt($comp['total']), $fmt($comp['repasse']), $venc,
           (string) ($perfil['config']['payee_code'] ?? $perfil['config']['fav_conta'] ?? ''),
           mb_substr((string) ($r['link'] ?? ''), 0, 255), $agora, $agora]);
        log_split('info', "Título {$t['id']} ({$t['login']}) registrado no " . $prov::nome() . ": {$r['id']} (total R$ "
            . number_format($comp['total'], 2, ',', '.') . ', repasse R$ ' . number_format($comp['repasse'], 2, ',', '.') . ').');
    } catch (Throwable $e) {
        q("INSERT INTO addon_split_titulos (id_lanc, perfil_id, situacao, valor, valor_repasse, vencimento, tentativas, erro, criado_em, atualizado_em)
           VALUES (?, ?, 'erro', ?, ?, ?, 1, ?, ?, ?)
           ON DUPLICATE KEY UPDATE situacao = 'erro', valor = VALUES(valor), valor_repasse = VALUES(valor_repasse),
             tentativas = tentativas + 1, erro = VALUES(erro), atualizado_em = VALUES(atualizado_em)",
          [(int) $t['id'], (int) $perfil['id'], number_format($comp['total'], 2, '.', ''), number_format($comp['repasse'], 2, '.', ''),
           $venc, $e->getMessage(), $agora, $agora]);
        log_split('erro', "Título {$t['id']} ({$t['login']}): " . $e->getMessage());
    }
}

/** Títulos em aberto da conta do perfil que ainda não estão no banco. */
function registrar_pendentes(array $perfil): int
{
    $split = (int) $perfil['conta_split'];
    if (!$split || (int) $perfil['ativo'] !== 1) {
        return 0;
    }
    $prov = provedor($perfil);
    $pend = q("SELECT l.id, l.login, l.valor, l.datavenc, l.referencia
                 FROM sis_lanc l
            LEFT JOIN addon_split_titulos a ON a.id_lanc = l.id
                WHERE l.numconta = ?
                  AND l.status = 'aberto'
                  AND (l.deltitulo = 0 OR l.deltitulo IS NULL)
                  AND (a.id_lanc IS NULL OR (a.situacao IN ('erro','substituir') AND a.tentativas < ?))
             ORDER BY l.datavenc
                LIMIT " . SPLIT_LOTE, [$split, SPLIT_MAX_TENTATIVAS]);
    foreach ($pend as $t) {
        registrar_titulo($perfil, $prov, $t);
    }
    return count($pend);
}

/**
 * Acompanha no MK-Auth o que aconteceu com os títulos já registrados:
 * apagado ou pago por outro meio → cancela no banco; valor mudou → cancela e
 * registra de novo; vencimento mudou → atualiza no banco.
 */
function sincronizar(): void
{
    $provs = [];
    $regs = q("SELECT a.id_lanc, a.perfil_id, a.charge_id, a.valor AS valor_banco, a.valor_repasse AS repasse_banco,
                      a.vencimento AS venc_banco, l.id, l.status, l.deltitulo, l.valor, l.datavenc, l.coletor
                 FROM addon_split_titulos a
            LEFT JOIN sis_lanc l ON l.id = a.id_lanc
                WHERE a.situacao = 'registrado'");
    foreach ($regs as $r) {
        try {
            $pid = (int) $r['perfil_id'];
            if (!isset($provs[$pid])) {
                $p = perfil($pid);
                $provs[$pid] = $p ? provedor($p) : null;
            }
            $prov = $provs[$pid];
            if (!$prov) {
                continue;
            }
            $apagado = $r['id'] === null || (int) $r['deltitulo'] === 1;
            $pagoFora = $r['status'] === 'pago' && $r['coletor'] !== SPLIT_COLETOR;
            if ($apagado || $pagoFora || in_array($r['status'], ['cancelado', 'estornado'], true)) {
                $prov->cancelar((string) $r['charge_id']);
                q("UPDATE addon_split_titulos SET situacao = 'cancelado', atualizado_em = NOW() WHERE id_lanc = ?", [(int) $r['id_lanc']]);
                log_split('info', "Cobrança {$r['charge_id']} cancelada no " . $prov::nome() . " (título {$r['id_lanc']} " . ($apagado ? 'apagado' : 'pago/cancelado por outro meio') . ').');
                continue;
            }
            if ($r['status'] !== 'aberto') {
                continue;
            }
            // Valor do título com os atrelados (um adicional atrelado ou tirado
            // muda o total e o repasse). repasse_banco NULL = boleto da regra
            // antiga, de percentual: refaz pela regra dos adicionais.
            $comp = composicao_titulo($r);
            $mudou = abs($comp['total'] - (float) $r['valor_banco']) > 0.004
                  || $r['repasse_banco'] === null
                  || abs($comp['repasse'] - (float) $r['repasse_banco']) > 0.004;
            if ($mudou) {
                $prov->cancelar((string) $r['charge_id']);
                q("UPDATE sis_lanc SET chave_gnet2 = NULL, linhadig = NULL, url = NULL WHERE id = ?", [(int) $r['id']]);
                q("UPDATE addon_split_titulos SET situacao = 'substituir', tentativas = 0, atualizado_em = NOW() WHERE id_lanc = ?", [(int) $r['id']]);
                $motivo = $r['repasse_banco'] === null
                    ? 'registrado pela regra antiga de percentual'
                    : "mudou de valor ({$r['valor_banco']} → {$comp['total']}, repasse {$r['repasse_banco']} → {$comp['repasse']})";
                log_split('info', "Título {$r['id']} $motivo: cobrança {$r['charge_id']} cancelada, vai ser registrada de novo.");
                continue;
            }
            $venc = substr((string) $r['datavenc'], 0, 10);
            if ($venc !== (string) $r['venc_banco'] && $venc >= date('Y-m-d')) {
                $prov->alterarVencimento((string) $r['charge_id'], $venc);
                q("UPDATE addon_split_titulos SET vencimento = ?, atualizado_em = NOW() WHERE id_lanc = ?", [$venc, (int) $r['id']]);
                log_split('info', "Vencimento do título {$r['id']} atualizado no " . $prov::nome() . " para $venc.");
            }
        } catch (Throwable $e) {
            log_split('erro', "Sincronizar título {$r['id_lanc']}: " . $e->getMessage());
        }
    }
}

// ---------------------------------------------------------------- baixa

/** Aplica os eventos que o provedor tirou do aviso do banco. Devolve quantos baixou. */
function aplicar_eventos(array $perfil, Provedor $prov, array $eventos): int
{
    $baixados = 0;
    foreach ($eventos as $ev) {
        $reg = q1("SELECT id_lanc FROM addon_split_titulos WHERE charge_id = ? AND perfil_id = ?",
                  [(string) $ev['id'], (int) $perfil['id']]);
        if (!$reg) {
            continue; // cobrança que não é deste perfil
        }
        $id = (int) $reg['id_lanc'];
        if ($ev['situacao'] === 'pago') {
            $valor = $ev['valor'] ?? (float) (q1("SELECT valor FROM sis_lanc WHERE id = ?", [$id])['valor'] ?? 0);
            if (baixar($prov, $id, (float) $valor, $ev['data'] ?: date('Y-m-d H:i:s'), (string) $ev['id'])) {
                $baixados++;
            }
        } elseif (in_array($ev['situacao'], ['cancelado', 'vencido'], true)) {
            q("UPDATE addon_split_titulos SET situacao = IF(situacao = 'pago', situacao, ?), atualizado_em = NOW() WHERE id_lanc = ?",
              [$ev['situacao'], $id]);
        }
    }
    return $baixados;
}

/** Dá baixa num título pago no banco. Devolve true se baixou agora. */
function baixar(Provedor $prov, int $idLanc, float $valorPago, string $dataPag, string $idBanco): bool
{
    $n = q("UPDATE sis_lanc SET status = 'pago', datapag = ?, valorpag = ?, formapag = ?, coletor = ?
             WHERE id = ? AND status <> 'pago'",
           [$dataPag, number_format($valorPago, 2, '.', ''), $prov->formapag(), SPLIT_COLETOR, $idLanc]);
    q("UPDATE addon_split_titulos SET situacao = 'pago', atualizado_em = NOW() WHERE id_lanc = ?", [$idLanc]);
    if ($n < 1) {
        return false;
    }
    // Mesmo lançamento de caixa que a baixa nativa faz.
    q("INSERT INTO sis_caixa (uuid_caixa, usuario, data, historico, complemento, entrada, saida, tipomov, planodecontas)
       VALUES (?, 'mk-bot', ?, ?, '', ?, 0, 'aut', 'Outros')",
      [uuid4(), $dataPag, $prov->historicoCaixa($idLanc), $valorPago]);
    log_split('info', "Título $idLanc pago (R$ " . number_format($valorPago, 2, ',', '.') . ", " . $prov::nome() . " $idBanco).");
    return true;
}
