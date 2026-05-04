import { IsInt, IsOptional, IsString, Max, Min, IsUUID } from 'class-validator';

export class CreateFeedbackDto {
  @IsUUID()
  requestId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  responseAccuracy?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  responseSpeed?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  communication?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  whatWorked?: string;

  @IsOptional()
  @IsString()
  whatNeedsImprovement?: string;
}
