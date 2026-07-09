import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignClientDto {
  @ApiProperty({ description: 'ID do cliente já cadastrado' })
  @IsString()
  clientId: string;
}
