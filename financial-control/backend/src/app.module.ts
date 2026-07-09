import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ClientsModule } from './modules/clients/clients.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { CreditCardsModule } from './modules/credit-cards/credit-cards.module';
import { AccountCategoriesModule } from './modules/account-categories/account-categories.module';
import { CostCentersModule } from './modules/cost-centers/cost-centers.module';
import { NotificationConfigModule } from './modules/notification-config/notification-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig],
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    SuppliersModule,
    ClientsModule,
    BankAccountsModule,
    CreditCardsModule,
    AccountCategoriesModule,
    CostCentersModule,
    NotificationConfigModule,
  ],
})
export class AppModule {}
