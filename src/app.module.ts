import { Module } from '@nestjs/common';
import { OtpsModule } from './otps/otps.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    OtpsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
