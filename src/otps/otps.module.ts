import { Module } from '@nestjs/common';
import { OtpsController } from './otps.controller';
import { OtpsService } from './otps.service';

@Module({
  controllers: [OtpsController],
  providers: [OtpsService]
})
export class OtpsModule {}
