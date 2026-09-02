import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * Contas da TV WIP grátis — a TV distribuída sem custo para os clientes.
 *
 * NÃO tem relação com o streaming pago da Watch Brasil (`streaming_assinantes`
 * / serviço STREAMER): são produtos diferentes, com bancos e regras próprios.
 *
 * O acesso ao aplicativo é feito com o mesmo login e senha do cadastro no
 * MKAuth, espelhados aqui. Só clientes ativos (`cli_ativado = 's'`) têm conta;
 * a varredura diária desativa quem deixou de ser cliente.
 */
@Entity("tv_wip_contas")
export class TvWipConta {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Login PPPoE do cliente — é também o usuário no aplicativo da TV. */
  @Index({ unique: true })
  @Column({ type: "varchar", length: 100 })
  login!: string;

  /** Senha do cadastro, usada para entrar no aplicativo. */
  @Column({ type: "varchar", length: 255, nullable: true })
  senha!: string | null;

  /** Nome do cliente, só para a tela não precisar consultar o MKAuth de novo. */
  @Column({ type: "varchar", length: 255, nullable: true })
  nome!: string | null;

  /**
   * Conta criada à mão, sem cadastro no MKAuth.
   *
   * A varredura diária pula essas contas: não existe cliente para comparar, e
   * sem isso ela as desativaria por "cliente inativo" logo na primeira noite.
   */
  @Column({ type: "boolean", default: false })
  avulso!: boolean;

  /** Anotação livre — usada para registrar por que a conta avulsa existe. */
  @Column({ type: "varchar", length: 255, nullable: true })
  observacao!: string | null;

  /** Conta liberada no aplicativo? */
  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  /** Quando foi desativada (manualmente ou pela varredura). */
  @Column({ type: "datetime", nullable: true })
  desativado_em!: Date | null;

  /**
   * Por que foi desativada: "cliente inativo no MKAuth" (automático) ou o
   * texto informado por quem desativou na tela.
   */
  @Column({ type: "varchar", length: 255, nullable: true })
  motivo_desativacao!: string | null;

  /** Usuário do sistema que desativou; nulo quando foi a varredura. */
  @Column({ type: "varchar", length: 100, nullable: true })
  desativado_por!: string | null;

  /** Última vez que a varredura confirmou a situação do cliente. */
  @Column({ type: "datetime", nullable: true })
  verificado_em!: Date | null;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at!: Date;
}
