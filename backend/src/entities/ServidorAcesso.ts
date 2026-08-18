import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/** Fabricante do equipamento — decide como conectar e quais comandos usar. */
export type TipoServidor = "mikrotik" | "huawei";

/**
 * Papel do equipamento na rede: concentrador de sessões PPPoE ou OLT. Um
 * Huawei pode ser qualquer um dos dois, e os comandos são diferentes.
 */
export type FuncaoServidor = "pppoe" | "olt";

/** Como o equipamento é acessado. OLTs antigas ainda só falam Telnet. */
export type ProtocoloServidor = "ssh" | "telnet";

/**
 * Servidores consultados pelo Client Analytics (concentradores PPPoE e OLTs).
 * Antes vinham do .env; agora são cadastrados pela tela de gerenciamento.
 */
@Entity("servidores_acesso")
export class ServidorAcesso {
  @PrimaryGeneratedColumn()
  id?: number;

  /** Nome exibido nas listagens, ex.: PPPOE1. */
  @Column({ type: "varchar", length: 64 })
  nome!: string;

  @Column({ type: "varchar", length: 16 })
  tipo!: TipoServidor;

  @Column({ type: "varchar", length: 16, default: "pppoe" })
  funcao!: FuncaoServidor;

  @Column({ type: "varchar", length: 16, default: "ssh" })
  protocolo!: ProtocoloServidor;

  @Column({ type: "varchar", length: 128 })
  host!: string;

  /** SSH da API do Mikrotik ou Telnet da OLT Huawei. */
  @Column({ type: "int" })
  porta!: number;

  @Column({ type: "varchar", length: 128 })
  login!: string;

  /** Guardada cifrada (AES-256-GCM); nunca sai pela API. */
  @Column({ type: "text" })
  senha!: string;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  /** Ordem de consulta nas varreduras. */
  @Column({ type: "int", default: 0 })
  ordem!: number;

  /**
   * Comando que lista os clientes conectados. Só faz sentido no Huawei, onde
   * varia por domínio (ex.: `display access-user domain 2wiptelecom`).
   */
  @Column({ type: "varchar", length: 255, nullable: true })
  comando_clientes?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  observacao?: string | null;

  @CreateDateColumn({ type: "timestamp" })
  criado_em?: Date;

  @UpdateDateColumn({ type: "timestamp" })
  atualizado_em?: Date;
}
