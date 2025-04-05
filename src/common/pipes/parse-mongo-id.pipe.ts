import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { isMongoId } from 'class-validator';

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!isMongoId(value)) {
      throw new BadRequestException(
        `"${value}" is not a valid MongoDB ObjectId.`,
      );
    }
    return value;
  }
}
