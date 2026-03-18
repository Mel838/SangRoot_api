import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CheckPhoneDto } from './dto/check-phone.dto';
import { CheckPhoneResponseDto } from './dto/check-phone-response.dto';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { DonorsService } from './donors.service';

@Controller('donors')
export class DonorsController {
  constructor(private readonly donorsService: DonorsService) {}

  // GET /donors/check-phone?phone=+237600000000
  @Get('check-phone')
  @HttpCode(HttpStatus.OK)
  async checkPhoneExists(
    @Query() query: CheckPhoneDto,
  ): Promise<CheckPhoneResponseDto> {
    const exists = await this.donorsService.checkPhoneExists(query.phone);
    return {
      exists,
      message: exists
        ? 'Phone number already registered'
        : 'Phone number available',
    };
  }

  // GET /donors/check-phone/:phone
  @Get('check-phone/:phone')
  @HttpCode(HttpStatus.OK)
  async checkPhoneExistsByPath(
    @Param('phone') phone: string,
  ): Promise<CheckPhoneResponseDto> {
    if (!phone?.trim()) {
      throw new BadRequestException('Phone number is required');
    }
    const exists = await this.donorsService.checkPhoneExists(phone);
    return {
      exists,
      message: exists
        ? 'Phone number already registered'
        : 'Phone number available',
    };
  }

  // POST /donors/check-phone-batch
  @Post('check-phone-batch')
  @HttpCode(HttpStatus.OK)
  async checkMultiplePhones(
    @Body('phones') phones: string[],
  ): Promise<{ results: { phone: string; exists: boolean }[] }> {
    if (!Array.isArray(phones) || phones.length === 0) {
      throw new BadRequestException('Please provide an array of phone numbers');
    }
    const results = await Promise.all(
      phones.map(async (phone) => ({
        phone,
        exists: await this.donorsService.checkPhoneExists(phone),
      })),
    );
    return { results };
  }

  // POST /donors/register
  // NOTE: In most cases BloodBank/Hospital/Doctor controllers call their own
  // POST /<module>/donors endpoint instead. This route is kept as a direct
  // fallback or for admin use. The 409 ConflictException is thrown inside
  // DonorsService and handled automatically by NestJS — no try/catch needed.
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerDonor(@Body() dto: RegisterDonorDto) {
    const donor = await this.donorsService.registerDonor(dto, {});
    return {
      success: true,
      message: 'Donor registered successfully',
      data: donor,
    };
  }
}
