import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrowserService } from './browser.service';

@Module({
    imports: [ConfigModule],
    providers: [BrowserService],
    exports: [BrowserService]
})
export class BrowserModule {}
