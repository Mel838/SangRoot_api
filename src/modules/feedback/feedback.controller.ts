import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Define a proper type for the request with user
interface RequestWithUser {
  user: {
    id: string;
    email?: string;
    role?: string;
  };
}

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.createOrUpdate(req.user.id, dto);
  }

  @Get('request/:requestId')
  getByRequest(
    @Req() req: RequestWithUser,
    @Param('requestId') requestId: string,
  ) {
    return this.feedbackService.findByRequestId(requestId, req.user.id);
  }

  @Get('my-feedback')
  getAll(
    @Req() req: RequestWithUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.feedbackService.findAllByDoctor(req.user.id, +page, +limit);
  }

  @Get('stats')
  getStats(@Req() req: RequestWithUser) {
    return this.feedbackService.getStats(req.user.id);
  }
}
