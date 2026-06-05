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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresRole } from '../../common/decorators/requires-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Listar todos os usuários (Admin)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; systemRole: SystemRole },
  ) {
    if (currentUser.id !== id && currentUser.systemRole !== SystemRole.ADMIN) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.usersService.findOne(id);
  }

  @Post()
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Criar usuário (Admin)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar usuário' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: { id: string; systemRole: SystemRole },
  ) {
    return this.usersService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativar usuário (soft delete, Admin)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
