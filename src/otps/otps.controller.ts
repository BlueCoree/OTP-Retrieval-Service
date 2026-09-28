import { Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { OtpsService } from './otps.service';

@Controller('otps')
export class OtpsController {
    constructor(private readonly otpService: OtpsService) { }

    @Post('fetch')
    @HttpCode(201)
    async fetchOtp(
        @Body('sender') sender?: string,
        @Body('profile') profile: string = 'profile',
    ) {
        return await this.otpService.fetchAndStoreOtp(sender, profile);
    }

    @Get()
    async getOtps(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    ) {
        return await this.otpService.getOtps(page, limit);
    }

    @Get(':id')
    async getOtpsById(@Param('id', ParseIntPipe) id: number) {
        return await this.otpService.getOtpsById(id);
    }

    @Delete(':id')
    async deleteOtps(@Param('id', ParseIntPipe) id: number) {
        return await this.otpService.deleteOtps(id);
    }
}
