import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

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

  @Column({ type: "varchar", length: 64, nullable: true })
  mkauth_chamado_id?: string;

  @Column({ type: "boolean", default: false })
  mkauth_sincronizado?: boolean;

  @Column({ type: "text", nullable: true })
  mkauth_erro?: string;
}
