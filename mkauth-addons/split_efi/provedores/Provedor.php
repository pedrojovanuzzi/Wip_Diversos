<?php
/**
 * Contrato de um banco/gateway no addon de split.
 *
 * Cada perfil de split usa um provedor (efi, sicoob, ...). O lib.php só fala com
 * esta classe; tudo que é específico do banco (API, formato do repasse,
 * credenciais, aviso de pagamento) fica no arquivo do provedor.
 *
 * Para criar um banco novo: copie provedores/sicoob.php, implemente os métodos
 * e registre a chave em provedores_disponiveis() no lib.php.
 */

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    http_response_code(404);
    exit;
}

abstract class Provedor
{
    /** @var array linha de addon_split_perfis, com 'config' já decodificado */
    protected $perfil;

    /** @var array|null linha do sis_boleto da conta de origem */
    protected $contaOrigem;

    public function __construct(array $perfil, ?array $contaOrigem)
    {
        $this->perfil = $perfil;
        $this->contaOrigem = $contaOrigem;
    }

    /** Chave curta gravada no perfil (efi, sicoob). */
    abstract public static function chave(): string;

    /** Nome para a tela. */
    abstract public static function nome(): string;

    /** Se o registro com split já está pronto para uso. */
    public static function implementado(): bool
    {
        return true;
    }

    /**
     * Condição SQL (sobre sis_boleto) das contas do MK-Auth que servem de
     * origem para este banco: delas vêm multa, juros e instruções (e, na Efí,
     * as credenciais).
     */
    abstract public static function filtroContasOrigem(): string;

    /**
     * Campos de configuração do perfil, desenhados pela tela.
     * Cada campo: [chave, rótulo, tipo (text|password|percent|select), ajuda, obrigatório, opções].
     * Campos 'password' nunca são devolvidos para a tela: em branco = mantém o salvo.
     */
    abstract public static function campos(): array;

    /** O que falta configurar (lista de frases). Vazio = pronto. */
    abstract public function pendencias(): array;

    /** Testa as credenciais. Lança exceção com mensagem clara se falhar. */
    abstract public function testar(): void;

    /**
     * Registra o título no banco já com o split.
     * $t: linha do sis_lanc (id, login, valor, datavenc, referencia).
     * $cli: linha do sis_cliente (nome, cpf_cnpj, celular, fone, email, endereço).
     * $urlRetorno: endereço que o banco deve chamar ao mudar a situação.
     * Devolve: ['id' => id no banco, 'linhadig' => ..., 'link' => ..., 'sis_lanc' => [coluna => valor]]
     */
    abstract public function registrar(array $t, array $cli, string $urlRetorno): array;

    /** Cancela (baixa sem pagamento) a cobrança no banco. */
    abstract public function cancelar(string $id): void;

    /** Muda o vencimento no banco. */
    abstract public function alterarVencimento(string $id, string $vencimento): void;

    /**
     * Trata o aviso que o banco mandou para o retorno.php.
     * Devolve eventos: [['id' => id no banco, 'situacao' => pago|cancelado|vencido|aberto,
     *                    'valor' => float|null, 'data' => 'Y-m-d H:i:s'|null], ...]
     */
    abstract public function processarRetorno(array $post, string $corpo): array;

    /** formapag gravado no sis_lanc na baixa. */
    public function formapag(): string
    {
        return static::chave();
    }

    /** Texto do lançamento no sis_caixa na baixa. */
    public function historicoCaixa(int $idLanc): string
    {
        return "Pagamento do titulo $idLanc com " . static::nome();
    }

    // ---------------------------------------------------------- ajudas

    protected function cfg(string $chave, string $padrao = ''): string
    {
        $v = $this->perfil['config'][$chave] ?? $padrao;
        return is_scalar($v) ? trim((string) $v) : $padrao;
    }

    protected function producao(): bool
    {
        return ($this->perfil['ambiente'] ?? '') === 'producao';
    }

    /** Percentual do parceiro como número (10.5 = 10,5%). */
    protected function percentual(): float
    {
        return (float) str_replace(',', '.', $this->cfg('percentual', '0'));
    }

    protected static function digitos(?string $s): string
    {
        return preg_replace('/\D/', '', (string) $s);
    }

    /** Vencimento para o banco: nunca no passado. */
    protected static function vencimento(array $t): string
    {
        $v = substr((string) $t['datavenc'], 0, 10);
        return $v < date('Y-m-d') ? date('Y-m-d') : $v;
    }

    protected static function http(string $metodo, string $url, array $headers, $corpo, array $curlExtra = []): array
    {
        $ch = curl_init($url);
        $opts = [
            CURLOPT_CUSTOMREQUEST => $metodo,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
        ];
        if ($corpo !== null) {
            $opts[CURLOPT_POSTFIELDS] = is_string($corpo) ? $corpo : json_encode($corpo, JSON_UNESCAPED_UNICODE);
        }
        curl_setopt_array($ch, $curlExtra + $opts);
        $txt = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $erro = curl_error($ch);
        curl_close($ch);
        if ($txt === false) {
            throw new RuntimeException(static::nome() . " sem resposta: $erro");
        }
        $json = json_decode($txt, true);
        return [$status, is_array($json) ? $json : ['_texto' => mb_substr($txt, 0, 500)]];
    }
}
