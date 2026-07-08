import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ProjectClientsController } from './project-clients.controller';
import { ClientsService } from './clients.service';

@Module({
  controllers: [ClientsController, ProjectClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
