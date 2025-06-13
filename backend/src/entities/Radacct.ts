import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('radacct')
export class Radacct {
  @PrimaryGeneratedColumn()
    radacctid!: number;

  @Column({ nullable: true })
    acctsessionid!: string;

  @Column({ nullable: true })
    acctuniqueid!: string;

  @Column({ nullable: true })
    username!: string;

  @Column({ nullable: true })
    groupname!: string;

  @Column({ nullable: true })
    realm!: string;

  @Column({ nullable: true })
    nasipaddress!: string;

  @Column({ nullable: true })
    nasportid!: string;

  @Column({ nullable: true })
    nasporttype!: string;

  @Column({ type: 'timestamp', nullable: true })
    acctstarttime!: Date;

  @Column({ type: 'timestamp', nullable: true })
    acctstoptime!: Date;

  @Column({ type: 'float', nullable: true })
    acctsessiontime!: number;

  @Column({ nullable: true })
    acctauthentic!: string;

  @Column({ type: 'timestamp', nullable: true })
    connectinfo_start!: Date;

  @Column({ type: 'timestamp', nullable: true })
    connectinfo_stop!: Date;

  @Column({ type: 'bigint', nullable: true })
    acctinputoctets!: string;

  @Column({ type: 'bigint', nullable: true })
    acctoutputoctets!: string;

  @Column({ nullable: true })
    calledstationid!: string;

  @Column({ nullable: true })
    callingstationid!: string;

  @Column({ nullable: true })
    acctterminatecause!: string;

  @Column({ nullable: true })
    servicetype!: string;

  @Column({ nullable: true })
    framedprotocol!: string;

  @Column({ nullable: true })
    framedipaddress!: string;

  @Column({ type: 'float', nullable: true })
    acctstartdelay!: number;

  @Column({ type: 'float', nullable: true })
    acctstopdelay!: number;

  @Column({ nullable: true })
    xascendsessionsvrkey!: string;

  @Column({ type: 'timestamp', nullable: true })
    acctupdatetime!: Date;

  @Column({ type: 'int', nullable: true })
    acctinterval!: number;
}
