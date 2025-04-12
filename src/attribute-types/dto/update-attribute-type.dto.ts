import { PartialType } from '@nestjs/mapped-types';
import { CreateAttributeTypeDto } from './create-attribute-type.dto';

export class UpdateAttributeTypeDto extends PartialType(CreateAttributeTypeDto) {}
