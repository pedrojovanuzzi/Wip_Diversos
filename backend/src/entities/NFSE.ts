import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("nfse")
export class NFSE {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  login!: string;

  @Column({ name: "numero_rps", type: "int" })
  numeroRps!: number;

  @Column({ name: "serie_rps", type: "varchar", length: 200 })
  serieRps!: string;

  @Column({ name: "tipo_rps", type: "int" })
  tipoRps!: number;

  @Column({ name: "data_emissao", type: "date" })
  dataEmissao!: Date;

  @Column({ name: "competencia", type: "date" })
  competencia!: Date;

  @Column({ name: "valor_servico", type: "decimal" })
  valorServico!: number;

  @Column({ name: "aliquota", type: "decimal" })
  aliquota!: number;

  @Column({ name: "iss_retido", type: "int" })
  issRetido!: number;

  @Column({ name: "responsavel_retencao", type: "int" })
  responsavelRetencao!: number;

  @Column({ name: "item_lista_servico", type: "varchar", length: 100 })
  itemListaServico!: string;

  @Column({ name: "discriminacao", type: "text" })
  discriminacao!: string;

  @Column({ name: "codigo_municipio", type: "int" })
  codigoMunicipio!: number;

  @Column({ name: "exigibilidade_iss", type: "int" })
  exigibilidadeIss!: number;

  @Column({ name: "cnpj_prestador", type: "varchar", length: 140 })
  cnpjPrestador!: string;

  @Column({
    name: "inscricao_municipal_prestador",
    type: "varchar",
    length: 200,
  })
  inscricaoMunicipalPrestador!: string;

  @Column({ name: "cpf_tomador", type: "varchar", length: 11 })
  cpfTomador!: string;

  @Column({ name: "razao_social_tomador", type: "varchar", length: 100 })
  razaoSocialTomador!: string;

  @Column({ name: "endereco_tomador", type: "varchar", length: 100 })
  enderecoTomador!: string;

  @Column({ name: "numero_endereco", type: "varchar", length: 100 })
  numeroEndereco!: string;

  @Column({ name: "complemento", type: "varchar", length: 50 })
  complemento!: string;

  @Column({ name: "bairro", type: "varchar", length: 50 })
  bairro!: string;

  @Column({ name: "uf", type: "varchar", length: 2 })
  uf!: string;

  @Column({ name: "cep", type: "varchar", length: 8 })
  cep!: string;

  @Column({ name: "telefone_tomador", type: "varchar", length: 15 })
  telefoneTomador!: string;

  @Column({ name: "email_tomador", type: "varchar", length: 100 })
  emailTomador!: string;

  @Column({ name: "optante_simples_nacional", type: "int" })
  optanteSimplesNacional!: number;

  @Column({ name: "incentivo_fiscal", type: "int" })
  incentivoFiscal!: number;

  @Column({ name: "ambiente", type: "varchar", length: 20 })
  ambiente!: string;

  @Column({ name: "status", type: "varchar", length: 20 })
  status!: string;

  @Column({ name: "numeroNfe", type: "int" })
  numeroNfe!: number;
}
