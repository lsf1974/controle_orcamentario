import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignCreditCardDto {
  @ApiProperty({ description: 'ID do cartão já cadastrado' })
  @IsString()
  creditCardId: string;
}
