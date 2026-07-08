import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client';
import { NotificationConfigService } from './notification-config.service';
import { UpsertNotificationConfigDto } from './dto/upsert-notification-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notification-config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notification-config')
export class NotificationConfigController {
  constructor(private service: NotificationConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Listar minhas configurações de notificação' })
  findMine(@CurrentUser() user: { id: string }) {
    return this.service.findAllForUser(user.id);
  }

  @Put(':channel')
  @ApiOperation({ summary: 'Criar/atualizar configuração de um canal (upsert)' })
  upsert(
    @CurrentUser() user: { id: string },
    @Param('channel', new ParseEnumPipe(NotificationChannel))
    channel: NotificationChannel,
    @Body() dto: UpsertNotificationConfigDto,
  ) {
    return this.service.upsert(user.id, channel, dto);
  }
}
