import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  BaseEntity,
  OneToMany,
} from "typeorm";
import { Category } from "./Category";
import { Log } from "./Log";
import { Note } from "./Note";

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  profilePictureUrl: string;

  @Column()
  password!: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Log, (log) => log.creator)
  logs: Log[];

  @OneToMany(() => Category, (category) => category.creator)
  categories: Category[];

  @OneToMany(() => Note, (note) => note.creator)
  notes: Note[];
}
