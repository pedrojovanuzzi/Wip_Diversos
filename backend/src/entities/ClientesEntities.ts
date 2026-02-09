import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("sis_cliente")
export class ClientesEntities {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  nome!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  email!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  endereco!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  bairro!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  cidade!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  cep!: string;

  @Column({ type: "varchar", length: 2, nullable: true })
  estado!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  cpf_cnpj!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  fone!: string;

  @Column({ type: "text", nullable: true })
  obs!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  nascimento!: string;

  @Column({ type: "enum", enum: ["S", "C", "D", "V"], nullable: true })
  estado_civil!: string;

  @Column({ type: "date", nullable: true })
  cadastro!: Date;

  @Column({ type: "varchar", length: 255, nullable: true })
  login!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  tipo!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  night!: string;

  @Column({ type: "text", nullable: true })
  aviso!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  foto!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  venc!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  mac!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  complemento!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  ip!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  ramal!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  rg!: string;

  @Column({ type: "boolean", nullable: true })
  isento!: boolean;

  @Column({ type: "varchar", length: 20, nullable: true })
  celular!: string;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  bloqueado!: string;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  autoip!: string;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  automac!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  conta!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  ipvsix!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  plano!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  send!: string;

  @Column({ type: "enum", enum: ["s", "n"], nullable: true })
  cli_ativado!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  simultaneo!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  turbo!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  comodato!: string;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  observacao!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  chavetipo!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  chave!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  contrato!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  ssid!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  senha!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  numero!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  responsavel!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  nome_pai!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  nome_mae!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  expedicao_rg!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  naturalidade!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  acessacen!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  pessoa!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  endereco_res!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  numero_res!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  bairro_res!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  cidade_res!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  cep_res!: string;

  @Column({ type: "varchar", length: 2, nullable: true })
  estado_res!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  complemento_res!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  desconto!: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  acrescimo!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  equipamento!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  vendedor!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  nextel!: string;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  accesslist!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  resumo!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  grupo!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  codigo!: string;

  @Column({ type: "enum", enum: ["pro", "tot"], nullable: true })
  prilanc!: string;

  @Column({ type: "enum", enum: ["aut", "man"], nullable: true })
  tipobloq!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  adesao!: number;

  @Column({ type: "int", nullable: true })
  mbdisco!: number;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  sms!: string;

  @Column({ type: "bigint", nullable: true })
  ltrafego!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  planodown!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  ligoudown!: string;

  @Column({ type: "enum", enum: ["on", "off"], nullable: true })
  statusdown!: string;

  @Column({ type: "enum", enum: ["on", "off"], nullable: true })
  statusturbo!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  opcelular!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  nome_res!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  coordenadas!: string;

  @Column({ type: "date", nullable: true })
  rem_obs!: Date;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  valor_sva!: number;

  @Column({ type: "int", nullable: true })
  dias_corte!: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  user_ip!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  user_mac!: string;

  @Column({ type: "date", nullable: true })
  data_ip!: Date;

  @Column({ type: "date", nullable: true })
  data_mac!: Date;

  @Column({ type: "date", nullable: true })
  last_update!: Date;

  @Column({ type: "date", nullable: true })
  data_bloq!: Date;

  @Column({ type: "text", nullable: true })
  tags!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  tecnico!: string;

  @Column({ type: "date", nullable: true })
  data_ins!: Date;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  altsenha!: string;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  geranfe!: string;

  @Column({ type: "enum", enum: ["now", "ant"], nullable: true })
  mesref!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  ipfall!: string;

  @Column({ type: "int", nullable: true })
  tit_abertos!: number;

  @Column({ type: "int", nullable: true })
  parc_abertas!: number;

  @Column({ type: "int", nullable: true })
  tipo_pessoa!: number;

  @Column({ type: "varchar", length: 20, nullable: true })
  celular2!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  mac_serial!: string;

  @Column({ type: "enum", enum: ["full", "down", "bloq"], nullable: true })
  status_corte!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  plano15!: string;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  pgaviso!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  porta_olt!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  caixa_herm!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  porta_splitter!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  onu_ont!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  switch!: string;

  @Column({ type: "int", nullable: true })
  tit_vencidos!: number;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  pgcorte!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  interface!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  login_atend!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  cidade_ibge!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  estado_ibge!: string;

  @Column({ type: "date", nullable: true })
  data_desbloq!: Date;

  @Column({ type: "varchar", length: 255, nullable: true })
  pool_name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  pool6!: string;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  rec_email!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  dot_ref!: string;

  @Column({ type: "int", nullable: true })
  conta_cartao!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  termo!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  opcelular2!: string;

  @Column({ type: "int", nullable: true })
  tipo_cliente!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  armario_olt!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  plano_bloqc!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  uuid_cliente!: string;

  @Column({ type: "date", nullable: true })
  data_desativacao!: Date;

  @Column({ type: "enum", enum: ["titulo", "carne"], nullable: true })
  tipo_cob!: string;

  @Column({ type: "tinyint", nullable: true })
  fortunus!: number;

  @Column({ type: "tinyint", nullable: true })
  gsici!: number;

  @Column({ type: "enum", enum: ["u", "r"], nullable: true })
  local_dici!: string;
}
