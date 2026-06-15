import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessGuard],
})
export class ProjectsModule {}
