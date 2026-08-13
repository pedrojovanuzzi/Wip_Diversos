import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export type AprEquipamento = { item: string; qtd: number };
export type AprEtapa = { etapa: string; riscos: string; medidas: string };
export type AprTrabalhador = { nome: string; cargo: string; rg: string };

export type AprDados = {
  processo?: string;
  area?: string;
  atividade?: string;
  data?: string;
  equipamentos?: AprEquipamento[];
  etapas?: AprEtapa[];
  trabalhadores?: AprTrabalhador[];
  servicos?: string[];
  servico_outro?: string;
  responsavel_apr?: string;
};

@Entity("chamados_ficha_tecnica")
export class ChamadoFichaTecnica {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: "varchar", length: 64 })
  chamado_number!: string;

  @Column({ type: "varchar", length: 255 })
  cliente!: string;

  @Column({ type: "varchar", length: 255 })
  usuario!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  senha_wifi?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  nome_wifi?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  nome_wifi_secundario?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  senha_wifi_secundario?: string;

  @Column({ type: "int", nullable: true })
  nota?: number;

  @Column({ type: "varchar", length: 64, default: "NENHUM" })
  tec_externo?: string;

  @Column({ type: "varchar", length: 64, default: "NENHUM" })
  tec_interno?: string;

  @Column({ type: "varchar", length: 64, default: "NENHUM" })
  tec_carro?: string;

  @Column({ type: "varchar", length: 32, nullable: true })
  placa_carro?: string;

  @Column({ type: "varchar", length: 64 })
  servico!: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  porta_olt?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  olt?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  caixa?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  splitter?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  sinal_power_meter?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  sinal_onu_antena?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  sinal_ccq_caixa?: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  ssid?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  mac?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  sn?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  horario_registro?: string;

  @Column({ type: "json", nullable: true })
  equipamentos?: Array<{
    tipo: string;
    qtd: number;
    conexao: "CABO" | "WIFI" | null;
    testado: boolean;
  }>;

  @Column({ type: "json", nullable: true })
  apr?: AprDados;

  @Column({ type: "longtext", nullable: true })
  apr_assinatura_base64?: string;

  @Column({ type: "text", nullable: true })
  motivo?: string;

  @Column({ type: "longtext", nullable: true })
  observacao?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  responsavel_nome?: string;

  @Column({ type: "varchar", length: 32, nullable: true })
  responsavel_cpf?: string;

  @Column({ type: "longtext", nullable: true })
  assinatura_base64?: string;

  @Column({ type: "int", nullable: true })
  criado_por?: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  criado_por_login?: string;

  @CreateDateColumn({ type: "timestamp" })
  criado_em?: Date;

  /** Celular informado por quem vai avaliar os técnicos; destino da pesquisa. */
  @Column({ type: "varchar", length: 32, nullable: true })
  celular_avaliacao?: string | null;

  /** Quando a pesquisa de satisfação foi enviada ao cliente (uma vez só). */
  @Column({ type: "timestamp", nullable: true })
  avaliacao_enviada_em?: Date | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  mkauth_chamado_id?: string;

  @Column({ type: "boolean", default: false })
  mkauth_sincronizado?: boolean;

  @Column({ type: "text", nullable: true })
  mkauth_erro?: string;
}
