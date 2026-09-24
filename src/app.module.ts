import { Module } from '@nestjs/common';
import { OtpsModule } from './otps/otps.module';
import { BrowserService } from './browser/browser.service';
import { BrowserModule } from './browser/browser.module';

@Module({
  imports: [OtpsModule, BrowserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
