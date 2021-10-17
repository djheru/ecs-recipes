import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInstructionDto {
  @IsString()
  @IsNotEmpty()
  readonly details: string;
}
