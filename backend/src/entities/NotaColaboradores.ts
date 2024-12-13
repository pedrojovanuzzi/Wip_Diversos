import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
@Entity('feedback')
export class Feedback {
    @PrimaryGeneratedColumn()
    id?: number

    @Column({ unique: true })
    unique_identifier?: string;

    @Column()
    login?: string

    @Column()
    opnion?: string

    @Column()
    note_internet?: string

    @Column()
    note_service?: string

    @Column()
    note_response_time?: string

    @Column()
    note_technician_service?: string

    @Column()
    you_problem_as_solved?: string

    @Column()
    you_recomend?: string

    @Column({ default: false })
    used?: boolean;
}