import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

/**
 * Canal da TV WIP — tabela do sistema legado em PHP (banco `wip_canais`).
 *
 * O esquema é o que o TV_WIP2 já usa; aqui só espelhamos para conseguir
 * listar e editar pelo painel. Os pacotes e os vínculos com clientes ficam no
 * banco do sistema (wip_diversos), referenciando `idcanal`.
 */
@Entity("tb_canais")
export class Canal {
  @PrimaryGeneratedColumn()
  idcanal!: number;

  /** Nome do canal exibido no aplicativo. */
  @Column({ type: "varchar", length: 255, nullable: true })
  canal!: string;

  /** Endereço do stream. */
  @Column({ type: "varchar", length: 500, nullable: true })
  url!: string;

  /** Caminho/arquivo da logo. */
  @Column({ type: "varchar", length: 500, nullable: true })
  imagens!: string;

  /** 1 = no ar. O legado usa inteiro, não boolean. */
  @Column({ type: "int", nullable: true, default: 1 })
  ativo!: number;

  @Column({ type: "int", nullable: true })
  visualizacoes!: number;
}
