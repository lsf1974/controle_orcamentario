import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
// import { AuthModule } from './modules/auth/auth.module';
// import { UsersModule } from './modules/users/users.module';
// import { ProjectsModule } from './modules/projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig],
      envFilePath: '.env',
    }),
    // AuthModule,
    // UsersModule,
    // ProjectsModule,
  ],
})
export class AppModule {}
