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
import { ClientsService } from './clients.service';
import { AssignClientDto } from './dto/assign-client.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/clients')
export class ProjectClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes associados ao projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.clientsService.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Associar cliente ao projeto (Admin/Gestor)' })
  assign(@Param('projectId') projectId: string, @Body() dto: AssignClientDto) {
    return this.clientsService.assignToProject(projectId, dto.clientId);
  }

  @Delete(':clientId')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desassociar cliente do projeto (Admin/Gestor)' })
  unassign(
    @Param('projectId') projectId: string,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.unassignFromProject(projectId, clientId);
  }
}
