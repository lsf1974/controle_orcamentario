import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardBrand } from '@prisma/client';

export class CreateCreditCardDto {
  @ApiProperty({ example: 'Cartão Corporativo' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ enum: CardBrand })
  @IsEnum(CardBrand)
  brand: CardBrand;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'lastFourDigits deve conter exatamente 4 dígitos' })
  lastFourDigits: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @Min(0)
  creditLimit: number;

  @ApiProperty({ example: 10, description: 'Dia do vencimento da fatura (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  billingDay: number;

  @ApiProperty({ example: 3, description: 'Dia do fechamento da fatura (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay: number;

  @ApiPropertyOptional({ description: 'Conta bancária de pagamento da fatura' })
  @IsOptional()
  @IsString()
  paymentAccountId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
