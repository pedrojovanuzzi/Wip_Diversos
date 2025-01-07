import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('sis_lanc')
export class Faturas {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'datetime', nullable: true })
    datavenc!: Date;

    @Column({ type: 'varchar', length: 64, nullable: true })
    nossonum!: string;

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
    valorger!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    coletor!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    linhadig!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    valor!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    valorpag!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    gwt_numero!: string;

    @Column({ type: 'enum', enum: ['sim', 'nao'], default: 'nao' })
    imp!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    referencia!: string;

    @Column({ type: 'enum', enum: ['fat', 'car'], default: 'fat' })
    tipocob!: string;

    @Column({ type: 'int', nullable: true })
    codigo_carne!: number;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_gnet!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_gnet2!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_bfacil!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_juno!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_galaxpay!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    chave_iugu!: string;

    @Column({ type: 'int', nullable: true })
    numconta!: number;

    @Column({ type: 'tinyint', default: 0 })
    gerourem!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    remvalor!: number;

    @Column({ type: 'datetime', nullable: true })
    remdata!: Date;

    @Column({ type: 'varchar', length: 100, nullable: true })
    formapag!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    fcartaobandeira!: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    fcartaonumero!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    fchequenumero!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    fchequebanco!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    fchequeagcc!: string;

    @Column({ type: 'decimal', precision: 4, scale: 2, default: 0.00 })
    percmulta!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    valormulta!: number;

    @Column({ type: 'decimal', precision: 4, scale: 2, default: 0.00 })
    percmora!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    valormora!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    percdesc!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    valordesc!: number;

    @Column({ type: 'tinyint', default: 0 })
    deltitulo!: number;

    @Column({ type: 'datetime', nullable: true })
    datadel!: Date;

    @Column({ type: 'int', nullable: true })
    num_recibos!: number;

    @Column({ type: 'int', nullable: true })
    num_retornos!: number;

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
    codigo_barras!: string;
}
