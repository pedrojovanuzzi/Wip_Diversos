// Importa os decoradores do TypeORM usados para definir a entidade e suas colunas
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Define que esta classe representa a tabela "radacct" no banco de dados
@Entity('radacct')
export class Radacct {
  // Define uma coluna chave primária auto incrementável chamada "radacctid"
  @PrimaryGeneratedColumn()
  radacctid!: number;

  // Define uma coluna do tipo VARCHAR, aceita nulo, representa o ID da sessão
  @Column({ type: 'varchar', nullable: true })
  acctsessionid!: string;

  // Define uma coluna do tipo VARCHAR para o identificador único da sessão
  @Column({ type: 'varchar', nullable: true })
  acctuniqueid!: string;

  // Nome de usuário autenticado (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  username!: string;

  // Grupo ao qual o usuário pertence (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  groupname!: string;

  // Domínio/realm de autenticação (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  realm!: string;

  // Endereço IP do NAS (equipamento de rede) - VARCHAR
  @Column({ type: 'varchar', nullable: true })
  nasipaddress!: string;

  // Identificador da porta do NAS (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  nasportid!: string;

  // Tipo de porta do NAS (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  nasporttype!: string;

  // Data/hora de início da sessão (TIMESTAMP)
  @Column({ type: 'timestamp', nullable: true })
  acctstarttime!: Date;

  // Data/hora de término da sessão (TIMESTAMP)
  @Column({ type: 'timestamp', nullable: true })
  acctstoptime!: Date;

  // Duração total da sessão em segundos (FLOAT)
  @Column({ type: 'float', nullable: true })
  acctsessiontime!: number;

  // Método de autenticação utilizado (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  acctauthentic!: string;

  // Data/hora de início da conexão (TIMESTAMP)
  @Column({ type: 'timestamp', nullable: true })
  connectinfo_start!: Date;

  // Data/hora de término da conexão (TIMESTAMP)
  @Column({ type: 'timestamp', nullable: true })
  connectinfo_stop!: Date;

  // Quantidade de bytes recebidos (BIGINT)
  @Column({ type: 'bigint', nullable: true })
  acctinputoctets!: number;

  // Quantidade de bytes enviados (BIGINT)
  @Column({ type: 'bigint', nullable: true })
  acctoutputoctets!: number;

  // MAC Address ou identificador da estação chamada (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  calledstationid!: string;

  // MAC Address ou identificador da estação que chamou (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  callingstationid!: string;

  // Causa do encerramento da sessão (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  acctterminatecause!: string;

  // Tipo de serviço prestado (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  servicetype!: string;

  // Protocolo de enquadramento (ex: PPP) (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  framedprotocol!: string;

  // Endereço IP atribuído ao usuário (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  framedipaddress!: string;

  // Atraso no início da sessão em segundos (FLOAT)
  @Column({ type: 'float', nullable: true })
  acctstartdelay!: number;

  // Atraso no término da sessão em segundos (FLOAT)
  @Column({ type: 'float', nullable: true })
  acctstopdelay!: number;

  // Chave do servidor Ascend Session (VARCHAR)
  @Column({ type: 'varchar', nullable: true })
  xascendsessionsvrkey!: string;

  // Data/hora da última atualização da sessão (TIMESTAMP)
  @Column({ type: 'timestamp', nullable: true })
  acctupdatetime!: Date;

  // Intervalo de atualização da sessão (INT)
  @Column({ type: 'int', nullable: true })
  acctinterval!: number;
}
