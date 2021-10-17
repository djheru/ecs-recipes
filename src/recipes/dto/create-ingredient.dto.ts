import { IsNotEmpty, IsString } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  readonly amount: string;

  @IsString()
  @IsNotEmpty()
  readonly unit: string;

  @IsString()
  @IsNotEmpty()
  readonly description: string;
}
