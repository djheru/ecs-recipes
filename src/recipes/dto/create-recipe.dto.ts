import { CreateIngredientDto } from './create-ingredient.dto';
import { CreateInstructionDto } from './create-instruction.dto';

export class CreateRecipeDto {
  readonly title: string;

  readonly description: string;

  readonly author: string;

  readonly ingredients: CreateIngredientDto[];

  readonly instructions: CreateInstructionDto[];
}
