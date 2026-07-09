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
import { AccountCategoriesService } from './account-categories.service';
import { CreateAccountCategoryDto } from './dto/create-account-category.dto';
import { UpdateAccountCategoryDto } from './dto/update-account-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/account-categories')
export class AccountCategoriesController {
  constructor(private service: AccountCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar plano de contas do projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Criar categoria (Admin/Gestor)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAccountCategoryDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':id')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Atualizar categoria (Admin/Gestor)' })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountCategoryDto,
  ) {
    return this.service.update(projectId, id, dto);
  }

  @Delete(':id')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir categoria (soft delete, Admin/Gestor)' })
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.service.remove(projectId, id);
  }
}
