import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryType, CategoryLevel } from '@prisma/client';

export class CreateAccountCategoryDto {
  @ApiProperty({ example: '1.1', description: 'Código único dentro do projeto' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiProperty({ example: 'Vendas de Produtos' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ enum: CategoryType })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty({ enum: CategoryLevel })
  @IsEnum(CategoryLevel)
  level: CategoryLevel;

  @ApiPropertyOptional({
    description: 'Obrigatório para CATEGORY e SUBCATEGORY; ausente em PACKAGE',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
