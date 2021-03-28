import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Note extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  text: string;

  @Column()
  createdAt: string;

  @Column()
  updatedAt: string;

  @Column()
  creatorId: number;
}
