<?php
/**
 * Agendamento do split (roda pelo /etc/cron.d/split_efi, como root, de 5 em 5 min).
 * Não mexe em cliente nenhum: quem entra no split é escolhido à mão na tela.
 * 1. registra no banco, com repasse, os títulos novos das contas dos perfis ativos;
 * 2. acompanha os já registrados (apagado, pago por fora, valor ou vencimento mudou).
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
    foreach (perfis() as $p) {
        if ((int) $p['ativo'] !== 1) {
            continue;
        }
        try {
            registrar_pendentes($p);
        } catch (Throwable $e) {
            log_split('erro', "Cron, perfil {$p['id']}: " . $e->getMessage());
        }
    }
    // Mesmo com perfil desativado, cuida do que já está no banco.
    sincronizar();
} catch (Throwable $e) {
    log_split('erro', 'Cron: ' . $e->getMessage());
    exit(1);
}
