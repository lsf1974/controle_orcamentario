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
import { BankAccountsService } from './bank-accounts.service';
import { AssignBankAccountDto } from './dto/assign-bank-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/bank-accounts')
export class ProjectBankAccountsController {
  constructor(private bankAccountsService: BankAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar contas bancárias associadas ao projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.bankAccountsService.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Associar conta bancária ao projeto (Admin/Gestor)' })
  assign(
    @Param('projectId') projectId: string,
    @Body() dto: AssignBankAccountDto,
  ) {
    return this.bankAccountsService.assignToProject(projectId, dto.bankAccountId);
  }

  @Delete(':bankAccountId')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desassociar conta bancária do projeto (Admin/Gestor)' })
  unassign(
    @Param('projectId') projectId: string,
    @Param('bankAccountId') bankAccountId: string,
  ) {
    return this.bankAccountsService.unassignFromProject(projectId, bankAccountId);
  }
}
