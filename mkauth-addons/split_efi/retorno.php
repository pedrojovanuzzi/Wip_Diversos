<?php
/**
 * Aviso de pagamento do banco (URL que o addon manda em cada cobrança).
 * retorno.php?p=<perfil>&t=<token>
 *
 * Público de propósito: quem chama é o banco. Proteção:
 *  - token aleatório na URL (?t=), comparado em tempo constante;
 *  - cada provedor confirma os dados no próprio banco (a Efí só manda um token
 *    de notificação; os dados vêm da consulta feita aqui, com a credencial);
 *  - só dá baixa em título que o addon registrou para aquele perfil.
 * Não devolve nenhum dado de cliente.
 */
require __DIR__ . '/lib.php';

header('Content-Type: application/json');

try {
    garantir_tabelas();
    $esperado = (string) cfg('token_retorno', '');
    if ($esperado === '' || !hash_equals($esperado, (string) ($_GET['t'] ?? ''))) {
        http_response_code(403);
        echo '{"ok":false}';
        exit;
    }
    $perfil = perfil((int) ($_GET['p'] ?? 0));
    if (!$perfil) {
        http_response_code(404);
        echo '{"ok":false}';
        exit;
    }
    $prov = provedor($perfil);
    try {
        $eventos = $prov->processarRetorno($_POST, (string) file_get_contents('php://input'));
    } catch (InvalidArgumentException $e) {
        http_response_code(400);
        echo '{"ok":false}';
        exit;
    }
    $baixados = aplicar_eventos($perfil, $prov, $eventos);
    echo json_encode(['ok' => true, 'baixados' => $baixados]);
} catch (Throwable $e) {
    // 500 faz o banco tentar de novo mais tarde.
    try { log_split('erro', 'Retorno: ' . $e->getMessage()); } catch (Throwable $ignore) {}
    http_response_code(500);
    echo '{"ok":false}';
}
