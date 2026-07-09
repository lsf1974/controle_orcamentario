import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { CreditCardsService } from './credit-cards.service';
import { AssignCreditCardDto } from './dto/assign-credit-card.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/credit-cards')
export class ProjectCreditCardsController {
  constructor(private creditCardsService: CreditCardsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cartões associados ao projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.creditCardsService.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Associar cartão ao projeto (Admin/Gestor)' })
  assign(
    @Param('projectId') projectId: string,
    @Body() dto: AssignCreditCardDto,
  ) {
    return this.creditCardsService.assignToProject(projectId, dto.creditCardId);
  }

  @Delete(':creditCardId')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desassociar cartão do projeto (Admin/Gestor)' })
  unassign(
    @Param('projectId') projectId: string,
    @Param('creditCardId') creditCardId: string,
  ) {
    return this.creditCardsService.unassignFromProject(projectId, creditCardId);
  }
}
