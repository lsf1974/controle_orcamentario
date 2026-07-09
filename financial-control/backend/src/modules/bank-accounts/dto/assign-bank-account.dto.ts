import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignBankAccountDto {
  @ApiProperty({ description: 'ID da conta bancária já cadastrada' })
  @IsString()
  bankAccountId: string;
}
