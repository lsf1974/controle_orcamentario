import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BankAccountType } from '@prisma/client';

export class CreateBankAccountDto {
  @ApiProperty({ example: 'Conta Corrente Principal' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'Banco do Brasil' })
  @IsString()
  @MinLength(2)
  bankName: string;

  @ApiPropertyOptional({ example: '001' })
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({ enum: BankAccountType })
  @IsEnum(BankAccountType)
  accountType: BankAccountType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  initialBalance?: number;

  @ApiProperty({ example: '2026-01-01', description: 'Data do saldo inicial' })
  @IsDateString()
  initialDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openFinanceId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
