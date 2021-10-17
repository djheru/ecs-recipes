import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateIngredientDto } from './create-ingredient.dto';
import { CreateInstructionDto } from './create-instruction.dto';

export class CreateRecipeDto {
  @IsString()
  @IsNotEmpty()
  readonly title: string;

  @IsString()
  @IsOptional()
  readonly description: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateIngredientDto)
  readonly ingredients: CreateIngredientDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInstructionDto)
  readonly instructions: CreateInstructionDto[];
}
