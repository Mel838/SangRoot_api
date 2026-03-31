import { IsEnum, IsUUID, IsObject } from 'class-validator';

export class DoctorCoordinatorCallbackDto {
  @IsUUID()
  requestId: string;

  @IsEnum(['DONOR_CONFIRMED', 'SUFFICIENT_REACHED', 'OUTREACH_COMPLETE'])
  event: 'DONOR_CONFIRMED' | 'SUFFICIENT_REACHED' | 'OUTREACH_COMPLETE';

  @IsObject()
  details: Record<string, any>;
}
