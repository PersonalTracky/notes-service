import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  BaseEntity,
  ManyToOne,
} from "typeorm";
import { Category } from "./Category";
import { User } from "./User";

@Entity()
export class Log extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  body: string;

  @CreateDateColumn()
  dateStart!: Date;

  @CreateDateColumn()
  dateEnd: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Category, (category) => category.logs, {
    onDelete:"CASCADE"
  })
  category: Category;

  @ManyToOne(() => User, (user) => user.logs)
  creator: User;
}