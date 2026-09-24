import { Module } from '@nestjs/common';
import { OtpsController } from './otps.controller';
import { OtpsService } from './otps.service';
import { BrowserModule } from '../browser/browser.module';

@Module({
  imports: [BrowserModule],
  controllers: [OtpsController],
  providers: [OtpsService]
})
export class OtpsModule {}
