import { Module } from '@nestjs/common';
import { UiBridgeController } from './ui-bridge.controller';
import { AttendanceV2Module } from '../attendance-v2';
import { RequestV2Module } from '../request-v2';

@Module({
  imports: [AttendanceV2Module, RequestV2Module],
  controllers: [UiBridgeController]
})
export class UiBridgeModule {}
