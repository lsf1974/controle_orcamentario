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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresRole } from '../../common/decorators/requires-role.decorator';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar fornecedores' })
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do fornecedor' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Criar fornecedor (Admin)' })
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar fornecedor (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir fornecedor (soft delete, Admin)' })
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}
