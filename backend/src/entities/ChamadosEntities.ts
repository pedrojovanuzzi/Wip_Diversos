import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('sis_suporte')
export class ChamadosEntities {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: 'varchar', length: 48 })
    uuid_suporte?: string;

    @Column({ type: 'varchar', length: 255 })
    assunto?: string;

    @Column({ type: 'datetime', nullable: true })
    abertura?: Date;

    @Column({ type: 'datetime', nullable: true })
    fechamento?: Date;

    @Column({ type: 'varchar', length: 255 })
    email?: string;

    @Column({ type: 'varchar', length: 255, default: 'aberto' })
    status?: string;

    @Column({ type: 'varchar', length: 255 })
    chamado?: string;

    @Column({ type: 'varchar', length: 255 })
    nome?: string;

    @Column({ type: 'varchar', length: 255 })
    login?: string;

    @Column({ type: 'varchar', length: 255 })
    atendente?: string;

    @Column({ type: 'datetime', nullable: true })
    visita?: Date;

    @Column({ type: 'varchar', length: 20 })
    ramal?: string;

    @Column({ type: 'enum', enum: ['sim', 'nao'], default: 'nao' })
    reply?: 'sim' | 'nao';

    @Column({ type: 'varchar', length: 20, default: 'normal' })
    prioridade?: string;

    @Column({ type: 'varchar', length: 255, default: 'todos' })
    tecnico?: string;

    @Column({ type: 'int', nullable: true })
    login_atend?: number;

    @Column({ type: 'varchar', length: 63, default: 'full_users' })
    login_atend_string?: string;

    @Column({ type: 'longtext', nullable: true })
    motivo_fechar?: string;
}
