import {
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpsertNotificationConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertDueToday?: boolean;

  @ApiPropertyOptional({ example: '08:00', description: 'Formato HH:mm' })
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'alertDueTodayTime deve estar no formato HH:mm' })
  alertDueTodayTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  alertDueInDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertOverdue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertLowBalance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  alertLowBalanceAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertPendingApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertDailySummary?: boolean;

  @ApiPropertyOptional({ example: '08:00', description: 'Formato HH:mm' })
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'alertDailySummaryTime deve estar no formato HH:mm' })
  alertDailySummaryTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertWeeklySummary?: boolean;

  @ApiPropertyOptional({ description: 'Dia da semana (0=domingo ... 6=sábado)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  alertWeeklyDay?: number;
}
