import { CategoriaCodef } from "../entities/CodefPlanoConta";

/**
 * Palpite inicial para cada plano de contas do MKAuth.
 *
 * Foi montado a partir dos 152 planos de contas que existem hoje no
 * `sis_contaspagar`. Não é verdade absoluta: é o que evita começar com a tela
 * inteira em branco. Qualquer linha em `codef_plano_contas` vence o que está
 * aqui, e é assim que uma decisão do contador deve ser registrada — não
 * editando este arquivo.
 *
 * Duas escolhas que valem explicar:
 *
 * - Encargos de folha (FGTS, INSS, previdência, IRRF sobre salário) entram em
 *   `pessoal`, não em tributo. São custo de mão de obra; "Carga Tributária" no
 *   CODEF é o imposto sobre a operação.
 * - Compra de equipamento, veículo e poste é `capex`: vira depreciação e a
 *   planilha manda deixar depreciação de fora do EBITDA.
 *
 * Os planos genéricos de valor alto — `outros` (R$ 1,18 mi acumulado),
 * `IMPOSTO - TED`, `COMPRAS MERCADO LIVRE`, `COMPRA DIVERSAS` — ficam de fora
 * de propósito. São ambíguos demais para um palpite, e cair calado em "Outras
 * Despesas" estragaria o EBITDA sem ninguém perceber. Aparecem na tela como
 * não classificados até alguém decidir.
 */
export const PLANOS_PADRAO: Record<string, CategoriaCodef> = {};

const definir = (categoria: CategoriaCodef, planos: string[]) => {
  for (const plano of planos) PLANOS_PADRAO[normalizarPlano(plano)] = categoria;
};

/**
 * Normaliza para comparar: sem acento, sem espaço sobrando, tudo em maiúscula.
 *
 * Não tenta consertar os nomes com a codificação quebrada que existem na base
 * ("MANUTENíƒâ€¡íƒÆ’O") — a coluna é latin1 e o estrago está gravado. Esses
 * caem como não classificados e são mapeados na tela, uma vez cada.
 */
export function normalizarPlano(valor: string): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

definir("pessoal", [
  "salario",
  "13salario",
  "vale",
  "ferias",
  "fgts",
  "inss",
  "planodesaude",
  "dispensa",
  "CONVENIO FARMACIA",
  "SEGURO COLABORADORES",
  "PREVENTIVA EXAME",
  "EXAMES PREVENTIVA",
  "PREVENTIVA ASO ANUAL",
  "ASO DEMISSIONAL/ADMISSIONAL",
  "ALIMENTACAO",
  "PAES CAFE DA MANHA",
  "MARMITAS",
  "ACADEMIA PROJETO SAUDE",
  "UNIFORMES 2024",
  "UNIFORME KEZO",
  "CURSOS NR35 E NR10",
  "CURSOS ONLINE",
  "CURSO NR1 - IZABEL",
  "CURSO NR10 VIANATEL - ARNALDO MARCHI",
  "PLATAFORMA DE CURSOS",
  "CRT DO TECNICO",
  "CRT DE PROJETOS",
  "CRT PROJETOS",
  "CONTRIBUICAO PREVIDENCIA",
  "CONTRIBUICAO PREVIDENCIA-IRRF",
  "PREVIDENCIA SOCIAL",
  "FUNDO DE GARANTIA",
  "IMPOSTOS DA FOLHA SALARIAL (FGTS)",
  "IRRF - IMPOSTO DE RENDA SOBRE FOLHA SALARAL",
]);

definir("link", [
  "internet",
  "LINK DEDICADO CLIG",
  "LINK DEDICADO ALGAR",
  "LINK DEDICADO BRAYO",
  "DDOS VIVO",
  "DDOC VIVO",
  "NIC BR",
  "ASN - BLOCOS DE IP - TARIFA ANUAL",
  "TV SISTEMA",
  "PLATAFORMA DE TV",
]);

definir("manutencao", [
  "manutencao",
  "reparos",
  "MATERIAL DE CONSTRUCAO",
  "COMPRA DE FERROS",
  "FERRAGENS DOBRAS",
  "CONCRETO OBRA WIP RENOVA CONCRETO",
  "BATERIA MOURA",
  "COMPRA BATERIA",
  "SERVICOS DE ELTRICA",
]);

definir("aluguel", [
  "aluguel",
  "COMPARTILHAMENTO DE POSTES CPFL",
  "AES TIETE AREALVA",
]);

definir("energia", ["eletricidade"]);

definir("marketing", [
  "propaganda",
  "publicidade",
  "BANNERS BAIRROS",
  "PRINT CALENDARIO",
  "LONA TOTEM",
  "ADESIVACAO STRADA 05",
  "COMPRA DE BONES 100 UNIDADES",
  "ENVIO DE SMS AOS CLIENTES",
  "BRINDES DO ANO DE 2022",
  "BRINDES DE FINAL DE ANO",
  "BRINDES 10 ANOS",
]);

definir("outras", [
  "combustivel",
  "software",
  "contabilidade",
  "telefone",
  "celular",
  "limpeza",
  "seguranca",
  "papelaria",
  "armarinho",
  "impressora",
  "tarifas",
  "cobranca",
  "agua",
  "hospedagem",
  "jornais",
  "transporte",
  "estacionamento",
  "multa",
  "mensalidade",
  "pintura",
  "CONSULTA DE CPF",
  "SOLINTEL ASSESSORIA JURIDICA",
  "SOLINTEL ASSESSORIA TV SEAC",
  "ASSESSORIA",
  "ACESSORIA JURIDICA",
  "ALTERACAO CONTRATO SOCIAL",
  "DOCUMENTO CARTORIO BAURU",
  "CERTIFICADO CNPJ",
  "SEGURO DE AUTOMOVEL",
  "SEGURO VEICULO STRADA",
  "SEGURO DOBLO",
  "IPVA",
  "IPVA 2024",
  "LICENCIAMENTO DE CARRO",
  "ABRINT CREDENCIAS",
  "FENINFRA",
  "MENSALIDADE ALVORADA",
  "BALSA PASSAGEM",
  "FRETE DA COMPRA",
  "DOACAO",
  "MANUTENCAO RETROESCAVADEIRA",
  "CONSERTO CARRO",
  "REVISAO STRADA",
  "COMPRA DE OLEO MAQUINA",
  "COMPRA DE OLEO MAQUINAS",
  "FACHADA",
  "FERRAGEM PARA PORTAO E OUTROS",
]);

definir("capex", [
  "equipamentos",
  "moveis",
  "COMPRA DE VEICULO STRADA",
  "VEICULO STRADA",
  "INSTALACAO DE POSTES",
  "COMPRA DE POSTE",
  "ATUALIZACAO SISTEMA SOLAR NA EMPRESA",
]);

definir("tributo_das", [
  "IMPOSTOS SIMPLES NACIONAL",
  "GUIA DAS IMPOSTO SOBRE NOTAS",
]);

definir("tributo_outros", [
  "icms",
  "iprj",
  "cofins",
  "iss",
  "DARF",
  "DARF IRRF",
  "DIFAL - DIFERENCA ALIQUOTA ESTADUAL",
  "DARE-SP DIFERENCIAL DE ALIQUOTA",
  "CFT ANUAL DA EMPRESA",
  "TAXA DE REFORMA TRIBUTARIA",
  "TAXA LOCALIZACAO WIP",
  "IRRF SOBRE NOTA CONVENIO",
]);

/**
 * Regras por histórico, avaliadas antes do plano de contas.
 *
 * O plano de contas do MKAuth não é confiável para imposto: o DAS de agosto de
 * 2026 (R$ 44.347) está lançado como `icms`, e só o histórico revela que é
 * Simples Nacional. Sem esta regra o valor continuaria sendo tributo — mas
 * cairia no balde errado se um dia a apuração for feita só com o DAS.
 */
export const HISTORICOS_PADRAO: { contem: string; categoria: CategoriaCodef }[] =
  [{ contem: "SIMPLES NACIONAL", categoria: "tributo_das" }];
