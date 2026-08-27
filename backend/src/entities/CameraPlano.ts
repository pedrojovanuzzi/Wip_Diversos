import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Planos de armazenamento das câmeras — fonte única, compartilhada.
 *
 * A tabela vive no banco `wip_cams` porque é o único que os dois sistemas
 * alcançam: o portal (Wip_Cams) conecta só nele, e este projeto chega nele
 * pelo `CamsSource`. Antes a lista era código duplicado nos dois repositórios,
 * e bastava um ficar para trás para o cliente travar no plano base.
 *
 * Quem grava `camera_clientes.storage_gb` é o Wip_Diversos; quem aplica o
 * limite de câmeras é o portal. Os dois leem esta tabela.
 */
@Entity("camera_planos")
export class CameraPlano {
  @PrimaryGeneratedColumn()
  id?: number;

  /** Cota de armazenamento em GB. É a chave do plano (casa com storage_gb). */
  @Column({ type: "int", unique: true })
  storage_gb!: number;

  /** Mensalidade do serviço CAMERA nesse plano (R$). */
  @Column({ type: "decimal", precision: 10, scale: 2 })
  preco_brl!: number;

  /** Máximo de câmeras que o cliente pode cadastrar. */
  @Column({ type: "int" })
  max_cameras!: number;

  /**
   * Planos desativados somem da venda mas continuam valendo para quem já os
   * tem — por isso não são apagados.
   */
  @Column({ type: "tinyint", width: 1, default: 1 })
  ativo!: boolean;

  @CreateDateColumn({ type: "timestamp" })
  created_at?: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at?: Date;
}
