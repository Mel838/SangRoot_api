import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async createOrUpdate(doctorId: string, dto: CreateFeedbackDto) {
    const { requestId, ...data } = dto;

    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: requestId },
      include: {
        donorResponses: true,
        bloodBankResponses: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found');
    }

    if (request.requesterId !== doctorId) {
      throw new ForbiddenException(
        'You can only provide feedback for your own requests',
      );
    }

    // Prepare agent response summary
    const agentResponseSummary = {
      bloodType: request.bloodGroup,
      quantity: request.unitsRequired,
      urgency: request.urgency,
      status: request.status,
      donorSummary: {
        total: request.donorResponses?.length || 0,
        available:
          request.donorResponses?.filter((r) => r.availability === 'AVAILABLE')
            .length || 0,
      },
      bloodBankSummary: {
        total: request.bloodBankResponses?.length || 0,
        available:
          request.bloodBankResponses?.filter((r) => r.available === true)
            .length || 0,
      },
    };

    return this.prisma.feedback.upsert({
      where: { requestId },
      update: { ...data, agentResponseSummary },
      create: {
        ...data,
        requestId,
        doctorId,
        agentResponseSummary,
        status: 'SUBMITTED',
      },
      include: {
        request: {
          select: {
            id: true,
            bloodGroup: true,
            unitsRequired: true,
            urgency: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findByRequestId(requestId: string, doctorId: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { requestId },
      include: {
        request: {
          select: {
            id: true,
            bloodGroup: true,
            unitsRequired: true,
            urgency: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!feedback) {
      return null;
    }

    if (feedback.doctorId !== doctorId) {
      throw new ForbiddenException('Access denied');
    }

    return feedback;
  }

  async findAllByDoctor(doctorId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where: { doctorId },
        include: {
          request: {
            select: {
              id: true,
              bloodGroup: true,
              unitsRequired: true,
              urgency: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.feedback.count({ where: { doctorId } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats(doctorId: string) {
    const feedbacks = await this.prisma.feedback.findMany({
      where: { doctorId },
      select: {
        overallRating: true,
        responseAccuracy: true,
        responseSpeed: true,
        communication: true,
      },
    });

    if (feedbacks.length === 0) {
      return {
        total: 0,
        avgOverall: 0,
        avgAccuracy: 0,
        avgSpeed: 0,
        avgCommunication: 0,
      };
    }

    const calculateAverage = (ratings: (number | null)[]): number => {
      const validRatings = ratings.filter(
        (rating): rating is number => rating !== null && rating !== undefined,
      );
      return validRatings.length > 0
        ? validRatings.reduce((sum, rating) => sum + rating, 0) /
            validRatings.length
        : 0;
    };

    return {
      total: feedbacks.length,
      avgOverall: calculateAverage(feedbacks.map((f) => f.overallRating)),
      avgAccuracy: calculateAverage(feedbacks.map((f) => f.responseAccuracy)),
      avgSpeed: calculateAverage(feedbacks.map((f) => f.responseSpeed)),
      avgCommunication: calculateAverage(feedbacks.map((f) => f.communication)),
    };
  }
}
