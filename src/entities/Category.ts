import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  BaseEntity,
  OneToMany,
  ManyToOne,
} from "typeorm";
import { Log } from "./Log";
import { User } from "./User";

@Entity()
export class Category extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  colour!: string;

  @Column({ unique: true })
  tag!: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column("text", { array: true })
  possibleValues: string[];

  @Column()
  type: string;

  @OneToMany(() => Log, (log) => log.category)
  logs: Log[];

  @ManyToOne(() => User, (user) => user.categories)
  creator: User;
}
