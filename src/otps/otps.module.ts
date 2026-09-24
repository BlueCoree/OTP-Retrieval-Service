import { Module } from '@nestjs/common';
import { OtpsController } from './otps.controller';
import { OtpsService } from './otps.service';
import { BrowserModule } from '../browser/browser.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [BrowserModule],
  controllers: [OtpsController],
  providers: [OtpsService, PrismaService]
})
export class OtpsModule {}
