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
import { ProjectRole } from '@prisma/client';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/cost-centers')
export class CostCentersController {
  constructor(private service: CostCentersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar centros de custo do projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Criar centro de custo (Admin/Gestor)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCostCenterDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':id')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Atualizar centro de custo (Admin/Gestor)' })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCostCenterDto,
  ) {
    return this.service.update(projectId, id, dto);
  }

  @Delete(':id')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir centro de custo (soft delete, Admin/Gestor)' })
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.service.remove(projectId, id);
  }
}
