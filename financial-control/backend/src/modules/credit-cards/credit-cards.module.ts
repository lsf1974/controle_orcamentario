import { Module } from '@nestjs/common';
import { CreditCardsController } from './credit-cards.controller';
import { ProjectCreditCardsController } from './project-credit-cards.controller';
import { CreditCardsService } from './credit-cards.service';

@Module({
  controllers: [CreditCardsController, ProjectCreditCardsController],
  providers: [CreditCardsService],
  exports: [CreditCardsService],
})
export class CreditCardsModule {}
