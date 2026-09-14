import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/** Para quem a notificação vai. */
export type DestinoNotificacao = "todos" | "pacotes" | "logins";

/**
 * Aviso enviado pelo painel para o aplicativo da TV WIP.
 *
 * O app busca as notificações quando abre e de tempos em tempos, e mostra no
 * envelope da grade. Não há push: TV box e Fire TV não têm o Google Play
 * Services garantido, e buscar é o que funciona em todos os aparelhos.
 *
 * Quem já leu fica guardado no próprio aparelho — o servidor não precisa saber,
 * e os logins fixos do app (sem conta aqui) também recebem os avisos gerais.
 */
@Entity("tv_wip_notificacoes")
export class TvWipNotificacao {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 120 })
  titulo!: string;

  @Column({ type: "text" })
  mensagem!: string;

  /**
   * `todos`: toda instalação do app, inclusive os logins fixos.
   * `pacotes`: contas que assistem algum dos pacotes em `alvos`.
   * `logins`: só as contas listadas em `alvos`.
   */
  @Column({ type: "varchar", length: 20, default: "todos" })
  destino!: DestinoNotificacao;

  /** IDs de pacote ou logins, conforme o destino. Vazio em `todos`. */
  @Column({ type: "simple-json", nullable: true })
  alvos!: (string | number)[] | null;

  /** Desligada some do app, mas continua no histórico do painel. */
  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  /** Depois disso o app deixa de receber. Nulo = sem prazo. */
  @Column({ type: "datetime", nullable: true })
  expira_em!: Date | null;

  /** Usuário do painel que enviou. */
  @Column({ type: "varchar", length: 100, nullable: true })
  criado_por!: string | null;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at!: Date;
}
