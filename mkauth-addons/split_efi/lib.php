<?php
/**
 * Addon SPLIT EFI para o MK-Auth.
 *
 * O MK-Auth registra boletos na Efí pelo código interno dele, sem split. Este
 * addon tira os clientes da conta Efí do MK-Auth (sis_boleto com gateway
 * 'gnet') e coloca numa conta própria com gateway 'fat', que o MK-Auth não
 * registra em lugar nenhum. O próprio addon registra cada título dessa conta
 * na Efí já com o repasse (items[].marketplace.repasses) e dá a baixa quando a
 * Efí avisa o pagamento.
 *
 * Só funções aqui. Quem usa: index.php (painel), cron.php (agendamento) e
 * retorno.php (aviso da Efí).
 */

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    http_response_code(404);
    exit;
}

// conexao.php fica em /opt/mk-auth/include (include_path do MK-Auth, web e CLI).
include_once('conexao.php');

const SPLIT_FORMAPAG = 'gerencianet';    // igual à baixa nativa, para os relatórios
const SPLIT_COLETOR = 'addon.split';      // diferente de 'url.retorno': mostra quem deu a baixa
const SPLIT_MAX_TENTATIVAS = 5;
const SPLIT_LOTE = 50;                     // títulos por rodada do cron

// ---------------------------------------------------------------- banco

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

function garantir_tabelas(): void
{
    db()->query("CREATE TABLE IF NOT EXISTS addon_split_config (
        chave VARCHAR(64) NOT NULL PRIMARY KEY,
        valor TEXT NULL
    ) DEFAULT CHARSET=utf8");

    // Conta que cada cliente tinha antes de entrar no split (para desfazer).
    db()->query("CREATE TABLE IF NOT EXISTS addon_split_clientes (
        login VARCHAR(64) NOT NULL PRIMARY KEY,
        conta_anterior VARCHAR(11) NOT NULL,
        movido_em DATETIME NOT NULL
    ) DEFAULT CHARSET=utf8");

    // Um registro por título do sis_lanc que o addon tentou registrar.
    db()->query("CREATE TABLE IF NOT EXISTS addon_split_titulos (
        id_lanc INT NOT NULL PRIMARY KEY,
        charge_id VARCHAR(32) NULL,
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

// ---------------------------------------------------------------- configuração

/** Contas do MK-Auth que registram na Efí pelo próprio MK-Auth. */
function contas_efi(): array
{
    return q("SELECT id, nome FROM sis_boleto WHERE gateway = 'gnet' AND (delconta IS NULL OR delconta <> 's') ORDER BY id");
}

function conta_origem(): ?array
{
    $id = (int) cfg('conta_origem', '0');
    return $id ? q1("SELECT * FROM sis_boleto WHERE id = ?", [$id]) : null;
}

function conta_split_id(): int
{
    return (int) cfg('conta_split', '0');
}

function ambiente(): string
{
    return cfg('ambiente', 'homologacao') === 'producao' ? 'producao' : 'homologacao';
}

/** Percentual do parceiro em centésimos de ponto (Efí: 2500 = 25%). */
function percentual_efi(): int
{
    return (int) round(((float) str_replace(',', '.', cfg('percentual', '0'))) * 100);
}

function url_retorno(): string
{
    $base = rtrim((string) cfg('url_base', ''), '/');
    return $base . '/admin/addons/split_efi/retorno.php?t=' . rawurlencode((string) cfg('token_retorno', ''));
}

/** O que falta para poder registrar. Lista vazia = pronto. */
function pendencias_config(): array
{
    $faltas = [];
    $origem = conta_origem();
    if (!$origem) {
        $faltas[] = 'Escolha a conta Efí de origem.';
    } else {
        [$id, $secret] = credenciais($origem);
        if ($id === '' || $secret === '') {
            $faltas[] = 'A conta de origem não tem Client ID/Secret de ' . (ambiente() === 'producao' ? 'produção' : 'homologação') . '.';
        }
    }
    if (trim((string) cfg('payee_code', '')) === '') {
        $faltas[] = 'Informe o payee_code da conta parceira.';
    }
    $p = percentual_efi();
    if ($p <= 0 || $p >= 10000) {
        $faltas[] = 'O percentual tem que ser maior que 0 e menor que 100.';
    }
    if (!preg_match('#^https?://#', (string) cfg('url_base', ''))) {
        $faltas[] = 'Informe o endereço público do MK-Auth (para a Efí avisar o pagamento).';
    }
    return $faltas;
}

// ---------------------------------------------------------------- Efí (API de Cobranças)

function credenciais(array $conta): array
{
    if (ambiente() === 'producao') {
        return [trim((string) $conta['cliente_id_gnet']), trim((string) $conta['cliente_secret_gnet'])];
    }
    return [trim((string) $conta['cliente_id_teste_gnet']), trim((string) $conta['cliente_secret_teste_gnet'])];
}

function efi_base(): string
{
    return ambiente() === 'producao'
        ? 'https://cobrancas.api.efipay.com.br'
        : 'https://cobrancas-h.api.efipay.com.br';
}

function http_json(string $metodo, string $url, array $headers, ?array $corpo): array
{
    $ch = curl_init($url);
    $hs = array_merge(['Content-Type: application/json', 'Accept: application/json'], $headers);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $metodo,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $hs,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    if ($corpo !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($corpo, JSON_UNESCAPED_UNICODE));
    }
    $txt = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $erro = curl_error($ch);
    curl_close($ch);
    if ($txt === false) {
        throw new RuntimeException("Efí sem resposta: $erro");
    }
    $json = json_decode($txt, true);
    return [$status, is_array($json) ? $json : ['_texto' => substr($txt, 0, 500)]];
}

function efi_token(bool $renovar = false): string
{
    $amb = ambiente();
    $cache = json_decode((string) cfg("token_$amb", ''), true);
    if (!$renovar && $cache && ($cache['ate'] ?? 0) > time() + 30) {
        return $cache['token'];
    }
    $origem = conta_origem();
    if (!$origem) {
        throw new RuntimeException('Conta de origem não configurada.');
    }
    [$id, $secret] = credenciais($origem);
    [$st, $r] = http_json('POST', efi_base() . '/v1/authorize', [
        'Authorization: Basic ' . base64_encode("$id:$secret"),
    ], ['grant_type' => 'client_credentials']);
    if ($st !== 200 || empty($r['access_token'])) {
        throw new RuntimeException('Efí recusou as credenciais: ' . efi_erro($r));
    }
    cfg_set("token_$amb", json_encode([
        'token' => $r['access_token'],
        'ate' => time() + (int) ($r['expires_in'] ?? 600),
    ]));
    return $r['access_token'];
}

function efi(string $metodo, string $caminho, ?array $corpo = null): array
{
    [$st, $r] = http_json($metodo, efi_base() . $caminho, ['Authorization: Bearer ' . efi_token()], $corpo);
    if ($st === 401) {
        [$st, $r] = http_json($metodo, efi_base() . $caminho, ['Authorization: Bearer ' . efi_token(true)], $corpo);
    }
    if ($st < 200 || $st >= 300) {
        throw new RuntimeException("Efí $metodo $caminho ($st): " . efi_erro($r));
    }
    return $r;
}

function efi_erro(array $r): string
{
    $d = $r['error_description'] ?? $r['_texto'] ?? $r;
    if (is_array($d)) {
        $d = json_encode($d, JSON_UNESCAPED_UNICODE);
    }
    return mb_substr((string) $d, 0, 500);
}

// ---------------------------------------------------------------- ativar / desativar

/**
 * Cria (uma vez) a conta de cobrança do split, copiando a conta de origem com
 * gateway 'fat': o MK-Auth gera o título, mas não registra em banco nenhum.
 */
function garantir_conta_split(): int
{
    $id = conta_split_id();
    if ($id && q1("SELECT id FROM sis_boleto WHERE id = ?", [$id])) {
        return $id;
    }
    $origem = conta_origem();
    if (!$origem) {
        throw new RuntimeException('Conta de origem não configurada.');
    }
    $nova = $origem;
    unset($nova['id']);
    $nova['uuid_boleto'] = uuid4();
    $nova['nome'] = 'EFI SPLIT (ADDON)';
    $nova['utilizar'] = 'fatura';
    $nova['banco'] = 'proprio.php';
    $nova['gateway'] = 'fat';
    $nova['calc_boleto'] = 'nao';   // senão o MK-Auth recalcula a linha digitável
    $nova['delconta'] = 'n';
    // Credenciais ficam só na conta de origem: a conta nova não fala com a Efí.
    foreach (['cliente_id_gnet', 'cliente_secret_gnet', 'cliente_id_teste_gnet',
              'cliente_secret_teste_gnet', 'token_gnet', 'id_conta_gnet', 'url_gnet'] as $c) {
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
    cfg_set('conta_split', (string) $id);
    log_split('info', "Conta de cobrança $id criada (cópia da conta {$origem['id']}, gateway fat).");
    return $id;
}

/** Passa para a conta do split os clientes que estão na conta Efí de origem. */
function mover_clientes(): int
{
    $origem = (int) cfg('conta_origem', '0');
    $split = conta_split_id();
    if (!$origem || !$split) {
        return 0;
    }
    $clientes = q("SELECT login, conta FROM sis_cliente WHERE conta = ?", [(string) $origem]);
    foreach ($clientes as $c) {
        q("INSERT INTO addon_split_clientes (login, conta_anterior, movido_em) VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE conta_anterior = VALUES(conta_anterior), movido_em = NOW()",
          [$c['login'], (string) $c['conta']]);
        q("UPDATE sis_cliente SET conta = ? WHERE login = ? AND conta = ?", [(string) $split, $c['login'], (string) $origem]);
    }
    if ($clientes) {
        log_split('info', count($clientes) . " cliente(s) passaram da conta $origem para a conta $split.");
    }
    return count($clientes);
}

function ativar(): void
{
    $faltas = pendencias_config();
    if ($faltas) {
        throw new RuntimeException(implode(' ', $faltas));
    }
    efi_token(true); // falha aqui se a credencial estiver errada
    garantir_conta_split();
    cfg_set('ativo', '1');
    mover_clientes();
    log_split('info', 'Split ativado.');
}

/**
 * Devolve cada cliente para a conta que tinha. Títulos já registrados pelo
 * addon continuam valendo na Efí e o retorno continua dando baixa neles.
 */
function desativar(): int
{
    cfg_set('ativo', '0');
    $split = conta_split_id();
    $n = 0;
    foreach (q("SELECT login, conta_anterior FROM addon_split_clientes") as $c) {
        $n += (int) q("UPDATE sis_cliente SET conta = ? WHERE login = ? AND conta = ?",
                      [$c['conta_anterior'], $c['login'], (string) $split]);
        q("DELETE FROM addon_split_clientes WHERE login = ?", [$c['login']]);
    }
    log_split('info', "Split desativado. $n cliente(s) voltaram para a conta anterior.");
    return $n;
}

// ---------------------------------------------------------------- registro dos títulos

function so_digitos(?string $s): string
{
    return preg_replace('/\D/', '', (string) $s);
}

function corpo_cobranca(array $t, array $cli, array $origem): array
{
    $doc = so_digitos($cli['cpf_cnpj'] ?? '');
    $nome = trim((string) $cli['nome']) ?: (string) $t['login'];
    $customer = [];
    if (strlen($doc) === 14) {
        $customer['juridical_person'] = ['corporate_name' => mb_substr($nome, 0, 255), 'cnpj' => $doc];
    } elseif (strlen($doc) === 11) {
        $customer['name'] = mb_substr($nome, 0, 255);
        $customer['cpf'] = $doc;
    } else {
        throw new RuntimeException('CPF/CNPJ inválido no cadastro do cliente.');
    }
    $fone = so_digitos($cli['celular'] ?: $cli['fone']);
    if (strlen($fone) > 11 && str_starts_with($fone, '55')) {
        $fone = substr($fone, 2);
    }
    if (preg_match('/^[1-9]{2}9?[0-9]{8}$/', $fone)) {
        $customer['phone_number'] = $fone;
    }
    $email = trim((string) ($cli['email'] ?? ''));
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $customer['email'] = $email;
    }

    $centavos = (int) round(((float) $t['valor']) * 100);
    $venc = substr((string) $t['datavenc'], 0, 10);
    if ($venc < date('Y-m-d')) {
        $venc = date('Y-m-d'); // a Efí não aceita vencimento no passado
    }
    $item = 'Mensalidade ' . trim((string) ($t['referencia'] ?: date('m/Y', strtotime((string) $t['datavenc']))));

    $billet = [
        'expire_at' => $venc,
        'customer' => $customer,
        // MK-Auth guarda multa em % e juros em % ao dia; a Efí usa centésimos de ponto.
        'configurations' => [
            'fine' => max(0, min(1000, (int) round(((float) $origem['multa']) * 100))),
            'interest' => max(0, min(330, (int) round(((float) $origem['juros']) * 1000))),
        ],
    ];
    $msg = trim((string) ($origem['instr_linha1'] ?? ''));
    if ($msg !== '') {
        $billet['message'] = mb_substr($msg, 0, 500);
    }

    return [
        'items' => [[
            'name' => mb_substr($item, 0, 255),
            'value' => $centavos,
            'amount' => 1,
            'marketplace' => [
                'repasses' => [[
                    'payee_code' => trim((string) cfg('payee_code')),
                    'percentage' => percentual_efi(),
                ]],
            ],
        ]],
        'metadata' => [
            'custom_id' => 'mk:' . $t['id'],
            'notification_url' => url_retorno(),
        ],
        'payment' => ['banking_billet' => $billet],
    ];
}

function registrar_titulo(array $t): void
{
    $origem = conta_origem();
    $cli = q1("SELECT nome, cpf_cnpj, celular, fone, email FROM sis_cliente WHERE login = ?", [$t['login']]);
    $agora = date('Y-m-d H:i:s');
    try {
        if (!$cli) {
            throw new RuntimeException('Cliente não encontrado no sis_cliente.');
        }
        $r = efi('POST', '/v1/charge/one-step', corpo_cobranca($t, $cli, $origem));
        $d = $r['data'] ?? [];
        if (empty($d['charge_id']) || empty($d['barcode'])) {
            throw new RuntimeException('Resposta da Efí sem charge_id/barcode.');
        }
        $link = $d['billet_link'] ?? $d['link'] ?? ($d['pdf']['charge'] ?? null);
        q("UPDATE sis_lanc SET chave_gnet2 = ?, linhadig = ?, url = ? WHERE id = ? AND (chave_gnet2 IS NULL OR chave_gnet2 = '')",
          [(string) $d['charge_id'], (string) $d['barcode'], (string) $link, (int) $t['id']]);
        q("INSERT INTO addon_split_titulos (id_lanc, charge_id, situacao, valor, vencimento, percentual, payee_code, link, tentativas, erro, criado_em, atualizado_em)
           VALUES (?, ?, 'registrado', ?, ?, ?, ?, ?, 1, NULL, ?, ?)
           ON DUPLICATE KEY UPDATE charge_id = VALUES(charge_id), situacao = 'registrado', valor = VALUES(valor),
             vencimento = VALUES(vencimento), percentual = VALUES(percentual), payee_code = VALUES(payee_code),
             link = VALUES(link), tentativas = tentativas + 1, erro = NULL, atualizado_em = VALUES(atualizado_em)",
          [(int) $t['id'], (string) $d['charge_id'], (string) $t['valor'], substr((string) $t['datavenc'], 0, 10),
           percentual_efi(), trim((string) cfg('payee_code')), (string) $link, $agora, $agora]);
        log_split('info', "Título {$t['id']} ({$t['login']}) registrado na Efí: charge {$d['charge_id']}.");
    } catch (Throwable $e) {
        q("INSERT INTO addon_split_titulos (id_lanc, situacao, valor, vencimento, tentativas, erro, criado_em, atualizado_em)
           VALUES (?, 'erro', ?, ?, 1, ?, ?, ?)
           ON DUPLICATE KEY UPDATE situacao = 'erro', tentativas = tentativas + 1, erro = VALUES(erro), atualizado_em = VALUES(atualizado_em)",
          [(int) $t['id'], (string) $t['valor'], substr((string) $t['datavenc'], 0, 10), $e->getMessage(), $agora, $agora]);
        log_split('erro', "Título {$t['id']} ({$t['login']}): " . $e->getMessage());
    }
}

/** Títulos em aberto da conta do split que ainda não estão na Efí. */
function registrar_pendentes(): int
{
    $split = conta_split_id();
    if (!$split) {
        return 0;
    }
    $pend = q("SELECT l.id, l.login, l.valor, l.datavenc, l.referencia
                 FROM sis_lanc l
            LEFT JOIN addon_split_titulos a ON a.id_lanc = l.id
                WHERE l.numconta = ?
                  AND l.status = 'aberto'
                  AND (l.deltitulo = 0 OR l.deltitulo IS NULL)
                  AND (l.chave_gnet2 IS NULL OR l.chave_gnet2 = '')
                  AND (a.id_lanc IS NULL OR (a.situacao IN ('erro','substituir') AND a.tentativas < ?))
             ORDER BY l.datavenc
                LIMIT " . SPLIT_LOTE, [$split, SPLIT_MAX_TENTATIVAS]);
    foreach ($pend as $t) {
        registrar_titulo($t);
    }
    return count($pend);
}

/**
 * Acompanha no MK-Auth o que aconteceu com os títulos já registrados:
 * apagado ou pago por outro meio → cancela na Efí; valor mudou → cancela e
 * registra de novo; vencimento mudou → atualiza na Efí.
 */
function sincronizar(): void
{
    $regs = q("SELECT a.id_lanc, a.charge_id, a.valor AS valor_efi, a.vencimento AS venc_efi,
                      l.id, l.status, l.deltitulo, l.valor, l.datavenc, l.formapag, l.coletor
                 FROM addon_split_titulos a
            LEFT JOIN sis_lanc l ON l.id = a.id_lanc
                WHERE a.situacao = 'registrado'");
    foreach ($regs as $r) {
        try {
            $apagado = $r['id'] === null || (int) $r['deltitulo'] === 1;
            $pago_fora = $r['status'] === 'pago' && $r['coletor'] !== SPLIT_COLETOR;
            if ($apagado || $pago_fora || in_array($r['status'], ['cancelado', 'estornado'], true)) {
                efi('PUT', "/v1/charge/{$r['charge_id']}/cancel");
                q("UPDATE addon_split_titulos SET situacao = 'cancelado', atualizado_em = NOW() WHERE id_lanc = ?", [(int) $r['id_lanc']]);
                log_split('info', "Charge {$r['charge_id']} cancelada na Efí (título {$r['id_lanc']} " . ($apagado ? 'apagado' : 'pago/cancelado por outro meio') . ').');
                continue;
            }
            if ($r['status'] !== 'aberto') {
                continue;
            }
            if (abs((float) $r['valor'] - (float) $r['valor_efi']) > 0.004) {
                efi('PUT', "/v1/charge/{$r['charge_id']}/cancel");
                q("UPDATE sis_lanc SET chave_gnet2 = NULL, linhadig = NULL, url = NULL WHERE id = ?", [(int) $r['id']]);
                q("UPDATE addon_split_titulos SET situacao = 'substituir', tentativas = 0, atualizado_em = NOW() WHERE id_lanc = ?", [(int) $r['id']]);
                log_split('info', "Título {$r['id']} mudou de valor ({$r['valor_efi']} → {$r['valor']}): charge {$r['charge_id']} cancelada, vai ser registrado de novo.");
                continue;
            }
            $venc = substr((string) $r['datavenc'], 0, 10);
            if ($venc !== (string) $r['venc_efi'] && $venc >= date('Y-m-d')) {
                efi('PUT', "/v1/charge/{$r['charge_id']}/billet", ['expire_at' => $venc]);
                q("UPDATE addon_split_titulos SET vencimento = ?, atualizado_em = NOW() WHERE id_lanc = ?", [$venc, (int) $r['id']]);
                log_split('info', "Vencimento do título {$r['id']} atualizado na Efí para $venc.");
            }
        } catch (Throwable $e) {
            log_split('erro', "Sincronizar título {$r['id_lanc']}: " . $e->getMessage());
        }
    }
}

// ---------------------------------------------------------------- baixa

/** Dá baixa num título pago na Efí. Devolve true se baixou agora. */
function baixar(int $idLanc, float $valorPago, string $dataPag, string $chargeId): bool
{
    $n = q("UPDATE sis_lanc SET status = 'pago', datapag = ?, valorpag = ?, formapag = ?, coletor = ?
             WHERE id = ? AND status <> 'pago' AND chave_gnet2 = ?",
           [$dataPag, number_format($valorPago, 2, '.', ''), SPLIT_FORMAPAG, SPLIT_COLETOR, $idLanc, $chargeId]);
    q("UPDATE addon_split_titulos SET situacao = 'pago', atualizado_em = NOW() WHERE id_lanc = ?", [$idLanc]);
    if ($n < 1) {
        return false;
    }
    // Mesmo lançamento de caixa que a baixa nativa da Efí faz.
    q("INSERT INTO sis_caixa (uuid_caixa, usuario, data, historico, complemento, entrada, saida, tipomov, planodecontas)
       VALUES (?, 'mk-bot', ?, ?, '', ?, 0, 'aut', 'Outros')",
      [uuid4(), $dataPag, "Pagamento do titulo $idLanc com EfiPay", $valorPago]);
    log_split('info', "Título $idLanc pago (R$ " . number_format($valorPago, 2, ',', '.') . ", charge $chargeId).");
    return true;
}
