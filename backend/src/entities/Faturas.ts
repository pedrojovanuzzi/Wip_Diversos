import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('sis_lanc')
export class Faturas {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'datetime', nullable: true })
    datavenc!: Date;

    @Column({ type: 'varchar', length: 64, nullable: true })
    nossnum!: string;

    @Column({ type: 'datetime', nullable: true })
    datapag!: Date;

    @Column({ type: 'varchar', length: 16, nullable: true })
    nome!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    recibo!: string;

    @Column({ type: 'varchar', length: 255, default: 'aberto' })
    status!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    login!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    tipo!: string;

    @Column({ type: 'varchar', length: 8, default: '5307' })
    cfop_lanc!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    obs!: string;

    @Column({ type: 'datetime', nullable: true })
    processamento!: Date;

    @Column({ type: 'varchar', length: 3, default: 'nao' })
    aviso!: string;

    @Column({ type: 'longtext', nullable: true })
    url!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    usergerou!: string;

    @Column({ type: 'varchar', length: 255, default: 'completo' })
    valoger!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    coletor!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    linhadig!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    valor!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    valorp!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    gwt_numerr!: string;

    @Column({ type: 'enum', enum: ['sim', 'nao'], default: 'nao' })
    imp!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    referencia!: string;

    @Column({ type: 'enum', enum: ['fat', 'car'], default: 'fat' })
    tipocob!: string;

    @Column({ type: 'int', nullable: true })
    codigo_carr!: number;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_gnet!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_gnet2!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_bfaci!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_juno!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_galax!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_iugu!: string;

    @Column({ type: 'int', nullable: true })
    numconta!: number;

    @Column({ type: 'tinyint', default: 0 })
    gerourem!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    removalor!: number;

    @Column({ type: 'datetime', nullable: true })
    remdata!: Date;

    @Column({ type: 'varchar', length: 100, nullable: true })
    formapag!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    fcartaoaband!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    fcartaonum!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    fchequenum!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    fchequeban!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    fchequeagc!: string;

    @Column({ type: 'decimal', precision: 4, scale: 2, default: 0.00 })
    percmulta!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    valormulta!: number;

    @Column({ type: 'decimal', precision: 4, scale: 2, default: 0.00 })
    percmora!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    valormora!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    perdesc!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    valordesc!: number;

    @Column({ type: 'tinyint', default: 0 })
    deltitulo!: number;

    @Column({ type: 'datetime', nullable: true })
    datadel!: Date;

    @Column({ type: 'int', nullable: true })
    num_recibo!: number;

    @Column({ type: 'int', nullable: true })
    num_retorno!: number;

    @Column({ type: 'tinyint', default: 0 })
    alt_venc!: number;

    @Column({ type: 'varchar', length: 16, nullable: true })
    uuid_lanc!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    tarifa_paga!: number;

    @Column({ type: 'int', nullable: true })
    id_empresa!: number;

    @Column({ type: 'tinyint', default: 0 })
    oco01!: number;

    @Column({ type: 'tinyint', default: 0 })
    oco02!: number;

    @Column({ type: 'tinyint', default: 0 })
    oco06!: number;

    @Column({ type: 'varchar', length: 64, nullable: true })
    codigo_barr!: string;
}
