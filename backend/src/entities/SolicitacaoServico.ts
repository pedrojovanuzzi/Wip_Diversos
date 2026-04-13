import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity('solicitacoes_servico')
export class SolicitacaoServico {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: 'varchar', length: 255 })
    servico?: string;

    @Column({ type: 'boolean', default: false })
    pago?: boolean;

    @Column({ type: 'varchar', length: 255 })
    login_cliente?: string;

    @CreateDateColumn({ type: 'timestamp' })
    data_solicitacao?: Date;

    @Column({ type: 'boolean', default: false })
    assinado?: boolean;

    @Column({ type: 'int', nullable: true })
    id_fatura?: number;

    @Column({ type: 'int', default: 0 })
    gratis?: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    token_zapsign?: string;

    @Column({ type: "json", nullable: true })
    dados?: any;

    @Column({ type: "boolean", default: false })
    finalizado?: boolean;

    @Column({ type: "boolean", default: false })
    consulta_cpf_realizada?: boolean;

    @Column({ type: "boolean", default: false })
    consulta_cpf_tentada?: boolean;

    @Column({ type: "varchar", length: 255, nullable: true })
    id_chamado?: string;

    @Column({ type: "boolean", default: false })
    cancelado?: boolean;
}
