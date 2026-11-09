<?php
/**
 * Agendamento do split (roda pelo /etc/cron.d/split_efi, como root, de 5 em 5 min).
 * 1. passa para a conta do split os clientes novos da conta Efí de origem;
 * 2. registra na Efí, com repasse, os títulos novos da conta do split;
 * 3. acompanha os já registrados (apagado, pago por fora, valor ou vencimento mudou).
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/lib.php';

$trava = fopen(sys_get_temp_dir() . '/split_efi.lock', 'c');
if (!$trava || !flock($trava, LOCK_EX | LOCK_NB)) {
    exit(0); // rodada anterior ainda em andamento
}

try {
    garantir_tabelas();
    if (cfg('ativo', '0') === '1') {
        mover_clientes();
        registrar_pendentes();
    }
    // Mesmo desativado, cuida do que já está na Efí.
    sincronizar();
} catch (Throwable $e) {
    log_split('erro', 'Cron: ' . $e->getMessage());
    exit(1);
}
