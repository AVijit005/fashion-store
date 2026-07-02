import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { EtaQueryDto } from './dto/eta-query.dto';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('eta')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getEta(@Query() q: EtaQueryDto) {
    return this.logistics.getEta(q.pincode);
  }
}
