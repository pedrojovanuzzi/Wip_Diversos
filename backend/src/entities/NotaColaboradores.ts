import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
@Entity('feedback')
export class Feedback {
    @PrimaryGeneratedColumn()
    id?: number

    @Column({ type: 'varchar', unique: true })
    unique_identifier?: string;

    @Column({type: 'varchar'})
    login?: string

    @Column({type: 'varchar', nullable: true})
    opnion?: string

    @Column({type: 'varchar', nullable: true})
    note_internet?: string

    @Column({type: 'varchar', nullable: true})
    note_service?: string

    @Column({type: 'varchar', nullable: true})
    note_response_time?: string

    @Column({type: 'varchar', nullable: true})
    note_technician_service?: string

    @Column({type: 'varchar', nullable: true})
    you_problem_as_solved?: string

    @Column({type: 'varchar', nullable: true})
    you_recomend?: string

    @Column({type: 'boolean', default: false })
    used?: boolean;

    @Column({type: 'datetime', nullable: true})
    time?: Date
}