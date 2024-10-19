import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('sis_func')
export class FuncionariosEntities {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 48 })
  uuid_func!: string;

  @Column({ type: 'varchar', length: 255 })
  nome!: string;

  @Column({ type: 'enum', enum: ['m', 'f'] })
  sexo!: 'm' | 'f';

  @Column({ type: 'varchar', length: 20, nullable: true })
  nascimento!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefone!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  celular!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  nextel!: string;

  @Column({ type: 'varchar', length: 20 })
  cpf!: string;

  @Column({ type: 'varchar', length: 20 })
  rg!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  email!: string;

  @Column({ type: 'varchar', length: 11 })
  cep!: string;

  @Column({ type: 'varchar', length: 255 })
  endereco!: string;

  @Column({ type: 'varchar', length: 11 })
  numero!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  complemento!: string;

  @Column({ type: 'varchar', length: 2 })
  estado!: string;

  @Column({ type: 'varchar', length: 255 })
  cidade!: string;

  @Column({ type: 'varchar', length: 11, nullable: true })
  data_adm!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  salario!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cargo!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  comissao!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bairro!: string;

  @Column({ type: 'enum', enum: ['t', 'i'] })
  tipo!: 't' | 'i';

  @Column({ type: 'varchar', length: 30, nullable: true })
  crc!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  cidade_ibge!: string;
}
