import { Module } from '@nestjs/common';
import { OtpsModule } from './otps/otps.module';
import { BrowserService } from './browser/browser.service';

@Module({
  imports: [OtpsModule],
  controllers: [],
  providers: [BrowserService],
})
export class AppModule {}
