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
}
