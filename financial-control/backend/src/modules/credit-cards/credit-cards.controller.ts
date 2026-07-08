import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CreditCardsService } from './credit-cards.service';
import { CreateCreditCardDto } from './dto/create-credit-card.dto';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresRole } from '../../common/decorators/requires-role.decorator';

@ApiTags('credit-cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credit-cards')
export class CreditCardsController {
  constructor(private creditCardsService: CreditCardsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cartões de crédito' })
  findAll() {
    return this.creditCardsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do cartão' })
  findOne(@Param('id') id: string) {
    return this.creditCardsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Criar cartão (Admin)' })
  create(@Body() dto: CreateCreditCardDto) {
    return this.creditCardsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar cartão (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateCreditCardDto) {
    return this.creditCardsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir cartão (soft delete, Admin)' })
  remove(@Param('id') id: string) {
    return this.creditCardsService.remove(id);
  }
}
