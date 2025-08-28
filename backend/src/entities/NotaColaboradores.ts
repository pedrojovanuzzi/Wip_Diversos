import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
@Entity('feedback')
export class Feedback {
    @PrimaryGeneratedColumn()
    id?: number

    @Column({ type: 'varchar', unique: true })
    unique_identifier?: string;

    @Column({type: 'varchar'})
    login?: string

    @Column({type: 'varchar'})
    opnion?: string

    @Column({type: 'varchar'})
    note_internet?: string

    @Column({type: 'varchar'})
    note_service?: string

    @Column({type: 'varchar'})
    note_response_time?: string

    @Column({type: 'varchar'})
    note_technician_service?: string

    @Column({type: 'varchar'})
    you_problem_as_solved?: string

    @Column({type: 'varchar'})
    you_recomend?: string

    @Column({type: 'boolean', default: false })
    used?: boolean;

    @Column({type: 'datetime'})
    time?: Date
}