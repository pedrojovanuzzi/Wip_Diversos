<?php
/**
 * Aviso de pagamento da Efí (notification_url das cobranças do split).
 *
 * Público de propósito: quem chama é a Efí. Proteção:
 *  - token aleatório na URL (?t=), comparado em tempo constante;
 *  - o POST só traz um token de notificação; os dados do pagamento vêm da
 *    consulta GET /v1/notification/:token feita aqui, com a credencial da Efí;
 *  - só dá baixa em título cujo chave_gnet2 bate com o charge_id da Efí.
 * Não devolve nenhum dado de cliente.
 */
require __DIR__ . '/lib.php';

header('Content-Type: application/json');

try {
    garantir_tabelas();
    $esperado = (string) cfg('token_retorno', '');
    $recebido = (string) ($_GET['t'] ?? '');
    if ($esperado === '' || !hash_equals($esperado, $recebido)) {
        http_response_code(403);
        echo '{"ok":false}';
        exit;
    }

    $token = (string) ($_POST['notification'] ?? '');
    if (!preg_match('/^[A-Za-z0-9-]{8,80}$/', $token)) {
        http_response_code(400);
        echo '{"ok":false}';
        exit;
    }

    $r = efi('GET', '/v1/notification/' . rawurlencode($token));
    $baixados = 0;
    foreach (($r['data'] ?? []) as $ev) {
        $chargeId = (string) ($ev['identifiers']['charge_id'] ?? '');
        $situacao = (string) ($ev['status']['current'] ?? '');
        if ($chargeId === '') {
            continue;
        }
        $reg = q1("SELECT id_lanc FROM addon_split_titulos WHERE charge_id = ?", [$chargeId]);
        if (!$reg) {
            continue; // cobrança que não é do addon
        }
        $id = (int) $reg['id_lanc'];
        if ($situacao === 'paid' || $situacao === 'settled') {
            $valor = isset($ev['value']) ? ((int) $ev['value']) / 100 : (float) (q1("SELECT valor FROM sis_lanc WHERE id = ?", [$id])['valor'] ?? 0);
            $quando = !empty($ev['received_by_bank_at']) ? date('Y-m-d H:i:s', strtotime($ev['received_by_bank_at'])) : date('Y-m-d H:i:s');
            if (baixar($id, $valor, $quando, $chargeId)) {
                $baixados++;
            }
        } elseif (in_array($situacao, ['canceled', 'expired', 'unpaid'], true)) {
            q("UPDATE addon_split_titulos SET situacao = IF(situacao = 'pago', situacao, ?), atualizado_em = NOW() WHERE id_lanc = ?",
              [$situacao === 'unpaid' ? 'registrado' : $situacao, $id]);
        }
    }
    echo json_encode(['ok' => true, 'baixados' => $baixados]);
} catch (Throwable $e) {
    // 500 faz a Efí tentar de novo mais tarde.
    try { log_split('erro', 'Retorno: ' . $e->getMessage()); } catch (Throwable $ignore) {}
    http_response_code(500);
    echo '{"ok":false}';
}
