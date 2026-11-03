import { Module } from '@nestjs/common';
import { STORE } from '../../core/tokens';
import { PayrollV2Repository } from '../../data/payroll-v2.repository';
import { PayrollV2Service } from '../../domain/payroll-v2';
import { PayrollV2Controller } from './payroll-v2.controller';

@Module({
  controllers: [PayrollV2Controller],
  providers: [
    PayrollV2Controller,
    {
      provide: PayrollV2Repository,
      useFactory: (store: any) => new PayrollV2Repository(store.queryBuilder),
      inject: [STORE]
    },
    {
      provide: PayrollV2Service,
      useFactory: (repo: PayrollV2Repository) => new PayrollV2Service(repo),
      inject: [PayrollV2Repository]
    }
  ],
  exports: [PayrollV2Service, PayrollV2Repository]
})
export class PayrollV2Module {}
