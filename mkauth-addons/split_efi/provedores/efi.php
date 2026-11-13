<?php
/**
 * Efí (Gerencianet): API de Cobranças, boleto com split por payee_code.
 * Credenciais: as da conta de origem do MK-Auth (sis_boleto, campos *_gnet).
 * Docs: https://dev.efipay.com.br/docs/api-cobrancas/split-de-pagamento
 */

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    http_response_code(404);
    exit;
}

class ProvedorEfi extends Provedor
{
    public static function chave(): string
    {
        return 'efi';
    }

    public static function nome(): string
    {
        return 'Efí';
    }

    public static function filtroContasOrigem(): string
    {
        return "gateway = 'gnet'";
    }

    public static function campos(): array
    {
        return [
            ['payee_code', 'payee_code do parceiro', 'text',
             'Identificador de conta do parceiro na Efí (painel Efí > API > Introdução > Identificador de conta). Precisa ser uma conta diferente da que emite o boleto. Recebe o valor dos serviços adicionais do título; a mensalidade fica na conta Efí que emite o boleto.', true, null],
        ];
    }

    public function formapag(): string
    {
        return 'gerencianet'; // igual à baixa nativa do MK-Auth, para os relatórios
    }

    public function historicoCaixa(int $idLanc): string
    {
        return "Pagamento do titulo $idLanc com EfiPay";
    }

    private function credenciais(): array
    {
        $c = $this->contaOrigem ?? [];
        if ($this->producao()) {
            return [trim((string) ($c['cliente_id_gnet'] ?? '')), trim((string) ($c['cliente_secret_gnet'] ?? ''))];
        }
        return [trim((string) ($c['cliente_id_teste_gnet'] ?? '')), trim((string) ($c['cliente_secret_teste_gnet'] ?? ''))];
    }

    public function pendencias(): array
    {
        $f = [];
        if (!$this->contaOrigem) {
            $f[] = 'Escolha a conta Efí de origem.';
        } else {
            [$id, $sec] = $this->credenciais();
            if ($id === '' || $sec === '') {
                $f[] = 'A conta de origem não tem Client ID/Secret de ' . ($this->producao() ? 'produção' : 'homologação')
                     . '. Preencha no cadastro da conta no MK-Auth.';
            }
        }
        if (!preg_match('/^[A-Za-z0-9]{8,64}$/', $this->cfg('payee_code'))) {
            $f[] = 'Informe o payee_code da conta parceira.';
        }
        return $f;
    }

    private function base(): string
    {
        return $this->producao() ? 'https://cobrancas.api.efipay.com.br' : 'https://cobrancas-h.api.efipay.com.br';
    }

    private function token(bool $renovar = false): string
    {
        $chaveCache = 'token_efi_' . (int) $this->perfil['id'] . '_' . ($this->producao() ? 'p' : 'h');
        $cache = json_decode((string) cfg($chaveCache, ''), true);
        if (!$renovar && $cache && ($cache['ate'] ?? 0) > time() + 30) {
            return $cache['token'];
        }
        [$id, $sec] = $this->credenciais();
        [$st, $r] = self::http('POST', $this->base() . '/v1/authorize', [
            'Content-Type: application/json',
            'Authorization: Basic ' . base64_encode("$id:$sec"),
        ], ['grant_type' => 'client_credentials']);
        if ($st !== 200 || empty($r['access_token'])) {
            throw new RuntimeException('A Efí recusou as credenciais: ' . self::erro($r));
        }
        cfg_set($chaveCache, json_encode(['token' => $r['access_token'], 'ate' => time() + (int) ($r['expires_in'] ?? 600)]));
        return $r['access_token'];
    }

    private function api(string $metodo, string $caminho, ?array $corpo = null): array
    {
        $h = fn($t) => ['Content-Type: application/json', 'Accept: application/json', 'Authorization: Bearer ' . $t];
        [$st, $r] = self::http($metodo, $this->base() . $caminho, $h($this->token()), $corpo);
        if ($st === 401) {
            [$st, $r] = self::http($metodo, $this->base() . $caminho, $h($this->token(true)), $corpo);
        }
        if ($st < 200 || $st >= 300) {
            throw new RuntimeException("Efí $metodo $caminho ($st): " . self::erro($r));
        }
        return $r;
    }

    private static function erro(array $r): string
    {
        $d = $r['error_description'] ?? $r['_texto'] ?? $r;
        return mb_substr(is_array($d) ? json_encode($d, JSON_UNESCAPED_UNICODE) : (string) $d, 0, 500);
    }

    public function testar(): void
    {
        $this->token(true);
    }

    public function registrar(array $t, array $cli, string $urlRetorno): array
    {
        $doc = self::digitos($cli['cpf_cnpj'] ?? '');
        $nome = trim((string) ($cli['nome'] ?? '')) ?: (string) $t['login'];
        $customer = [];
        if (strlen($doc) === 14) {
            $customer['juridical_person'] = ['corporate_name' => mb_substr($nome, 0, 255), 'cnpj' => $doc];
        } elseif (strlen($doc) === 11) {
            $customer['name'] = mb_substr($nome, 0, 255);
            $customer['cpf'] = $doc;
        } else {
            throw new RuntimeException('CPF/CNPJ inválido no cadastro do cliente.');
        }
        $fone = self::digitos(($cli['celular'] ?? '') ?: ($cli['fone'] ?? ''));
        if (strlen($fone) > 11 && strpos($fone, '55') === 0) {
            $fone = substr($fone, 2);
        }
        if (preg_match('/^[1-9]{2}9?[0-9]{8}$/', $fone)) {
            $customer['phone_number'] = $fone;
        }
        $email = trim((string) ($cli['email'] ?? ''));
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $customer['email'] = $email;
        }

        $o = $this->contaOrigem ?? [];
        $billet = [
            'expire_at' => self::vencimento($t),
            'customer' => $customer,
            // MK-Auth: multa em %, juros em % ao dia. Efí: centésimos de ponto (200 = 2%, 33 = 0,033%/dia).
            'configurations' => [
                'fine' => max(0, min(1000, (int) round(((float) ($o['multa'] ?? 0)) * 100))),
                'interest' => max(0, min(330, (int) round(((float) ($o['juros'] ?? 0)) * 1000))),
            ],
        ];
        $msg = trim((string) ($o['instr_linha1'] ?? ''));
        if ($msg !== '') {
            $billet['message'] = mb_substr($msg, 0, 500);
        }
        $comp = $t['composicao'] ?? ['empresa' => (float) $t['valor'], 'adicionais' => []];
        $nomeMens = 'Mensalidade ' . trim((string) ($t['referencia'] ?: date('m/Y', strtotime((string) $t['datavenc']))));

        // O repasse da Efí é por item: a mensalidade vai sem repasse (fica toda
        // na conta emissora) e cada serviço adicional vai com 100% para o parceiro.
        $items = [];
        $centMens = (int) round($comp['empresa'] * 100);
        if ($centMens > 0) {
            $items[] = ['name' => mb_substr($nomeMens, 0, 255), 'value' => $centMens, 'amount' => 1];
        }
        foreach ($comp['adicionais'] as $a) {
            $cent = (int) round($a['valor'] * 100);
            if ($cent <= 0) {
                continue;
            }
            $items[] = [
                'name' => mb_substr($a['desc'], 0, 255),
                'value' => $cent,
                'amount' => 1,
                'marketplace' => ['repasses' => [[
                    'payee_code' => $this->cfg('payee_code'),
                    'percentage' => 10000, // 10000 = 100%
                ]]],
            ];
        }
        if (!$items) {
            throw new RuntimeException('Título sem valor a cobrar.');
        }

        $r = $this->api('POST', '/v1/charge/one-step', [
            'items' => $items,
            'metadata' => ['custom_id' => 'mk:' . $t['id'], 'notification_url' => $urlRetorno],
            'payment' => ['banking_billet' => $billet],
        ]);
        $d = $r['data'] ?? [];
        if (empty($d['charge_id']) || empty($d['barcode'])) {
            throw new RuntimeException('Resposta da Efí sem charge_id/barcode.');
        }
        $link = $d['billet_link'] ?? $d['link'] ?? ($d['pdf']['charge'] ?? '');
        return [
            'id' => (string) $d['charge_id'],
            'linhadig' => (string) $d['barcode'],
            'link' => (string) $link,
            // mesmo lugar onde o MK-Auth guarda o id da cobrança Efí
            'sis_lanc' => ['chave_gnet2' => (string) $d['charge_id'], 'linhadig' => (string) $d['barcode'], 'url' => (string) $link],
        ];
    }

    public function cancelar(string $id): void
    {
        $this->api('PUT', '/v1/charge/' . rawurlencode($id) . '/cancel');
    }

    public function alterarVencimento(string $id, string $vencimento): void
    {
        $this->api('PUT', '/v1/charge/' . rawurlencode($id) . '/billet', ['expire_at' => $vencimento]);
    }

    public function processarRetorno(array $post, string $corpo): array
    {
        $token = (string) ($post['notification'] ?? '');
        if (!preg_match('/^[A-Za-z0-9-]{8,80}$/', $token)) {
            throw new InvalidArgumentException('Aviso da Efí sem token.');
        }
        // O POST só traz o token: os dados vêm da própria Efí.
        $r = $this->api('GET', '/v1/notification/' . rawurlencode($token));
        $mapa = ['paid' => 'pago', 'settled' => 'pago', 'canceled' => 'cancelado', 'expired' => 'vencido', 'unpaid' => 'aberto'];
        $ev = [];
        foreach (($r['data'] ?? []) as $e) {
            $id = (string) ($e['identifiers']['charge_id'] ?? '');
            $sit = $mapa[(string) ($e['status']['current'] ?? '')] ?? null;
            if ($id === '' || $sit === null) {
                continue;
            }
            $ev[] = [
                'id' => $id,
                'situacao' => $sit,
                'valor' => isset($e['value']) ? ((int) $e['value']) / 100 : null,
                'data' => !empty($e['received_by_bank_at']) ? date('Y-m-d H:i:s', strtotime($e['received_by_bank_at'])) : null,
            ];
        }
        return $ev;
    }
}
