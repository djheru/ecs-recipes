import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Recipe } from './recipe.entity';

@Entity()
export class Instruction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  amount: string;

  @Column()
  unit: string;

  @Column()
  description: string;

  @ManyToOne(() => Recipe, (recipe) => recipe.instructions)
  recipe: Recipe;
}
