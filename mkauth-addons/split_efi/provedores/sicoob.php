<?php
/**
 * Sicoob: API Cobrança Bancária v3, boleto com rateio de créditos (rateioCreditos).
 *
 * AINDA NÃO IMPLEMENTADO. Os campos de configuração e as pendências já existem,
 * para dar para montar o perfil; registrar/cancelar/retorno lançam erro claro
 * até a integração ser escrita com a documentação oficial do Sicoob
 * (developers.sicoob.com.br) e credenciais de teste.
 *
 * O que se sabe: a API v3 usa OAuth2 client_credentials com certificado A1
 * (mTLS), e o registro de boleto aceita "rateioCreditos" (repasse do crédito
 * para outra conta, inclusive de outro banco). O formato exato dos campos do
 * rateio ainda precisa ser conferido na documentação. O rateio tem que seguir a
 * mesma regra da Efí: só a soma dos serviços adicionais ($t['composicao']['repasse'])
 * vai para o parceiro.
 */

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    http_response_code(404);
    exit;
}

class ProvedorSicoob extends Provedor
{
    public static function chave(): string
    {
        return 'sicoob';
    }

    public static function nome(): string
    {
        return 'Sicoob';
    }

    public static function implementado(): bool
    {
        return false;
    }

    public static function filtroContasOrigem(): string
    {
        return "(banco = 'sicoob.php' OR codbanco = '756')";
    }

    public static function campos(): array
    {
        return [
            ['fav_nome', 'Nome do titular da conta do parceiro', 'text', 'O parceiro recebe o valor dos serviços adicionais do título; a mensalidade fica na conta Sicoob que emite o boleto.', true, null],
            ['fav_documento', 'CPF/CNPJ do titular', 'text', 'Só números.', true, null],
            ['fav_banco', 'Banco do parceiro (código)', 'text', 'Ex.: 756 (Sicoob), 001, 237.', true, null],
            ['fav_agencia', 'Agência do parceiro', 'text', 'Sem dígito.', true, null],
            ['fav_conta', 'Conta do parceiro', 'text', 'Com dígito, só números.', true, null],
            ['client_id', 'Client ID da API Sicoob', 'text', 'Do Portal Developers Sicoob (API Cobrança Bancária v3).', true, null],
            ['cert_pem', 'Caminho do certificado (.pem) no servidor', 'text', 'Certificado A1 convertido para PEM, com a chave. Ex.: /opt/mk-auth/certs/sicoob.pem', true, null],
            ['cert_senha', 'Senha do certificado', 'password', 'Deixe em branco para manter a senha salva.', false, null],
            ['numero_cliente', 'Número do cliente (beneficiário) no Sicoob', 'text', '', true, null],
            ['modalidade', 'Modalidade da cobrança', 'text', 'Ex.: 1 (simples com registro).', true, null],
        ];
    }

    public function pendencias(): array
    {
        $f = ['A integração com o Sicoob ainda não foi escrita: dá para preencher o perfil, mas não para ativar.'];
        if (!$this->contaOrigem) {
            $f[] = 'Escolha a conta Sicoob de origem.';
        }
        foreach (self::campos() as [$chave, $rotulo, , , $obrig]) {
            if ($obrig && $this->cfg($chave) === '') {
                $f[] = "Preencha: $rotulo.";
            }
        }
        $cert = $this->cfg('cert_pem');
        if ($cert !== '' && !is_readable($cert)) {
            $f[] = 'O certificado não existe ou não pode ser lido nesse caminho.';
        }
        return $f;
    }

    private function naoImplementado(): void
    {
        throw new RuntimeException('Integração com o Sicoob ainda não implementada.');
    }

    public function testar(): void
    {
        $this->naoImplementado();
    }

    public function registrar(array $t, array $cli, string $urlRetorno): array
    {
        $this->naoImplementado();
        return [];
    }

    public function cancelar(string $id): void
    {
        $this->naoImplementado();
    }

    public function alterarVencimento(string $id, string $vencimento): void
    {
        $this->naoImplementado();
    }

    public function processarRetorno(array $post, string $corpo): array
    {
        $this->naoImplementado();
        return [];
    }
}
