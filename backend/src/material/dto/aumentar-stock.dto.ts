import { IsNumber, Min } from 'class-validator';

export class AumentarStockDTO {
  @IsNumber()
  @Min(1)
  cantidad!: number;
}