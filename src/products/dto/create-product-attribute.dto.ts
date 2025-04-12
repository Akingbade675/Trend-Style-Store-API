import { Transform } from 'class-transformer';
import { IsArray, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

const TransformToArray = () =>
  Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : (value
          ?.split('|')
          .map((item) => item.trim())
          .filter((item) => item.length > 0) ?? []),
  );

export class CreateProductAttributeDto {
  @IsNotEmpty()
  @IsArray()
  @TransformToArray()
  @IsString({ each: true })
  value: string[]; // Array of attribute values (e.g., ["Red", "Blue"])

  @IsMongoId()
  @IsNotEmpty()
  attributeTypeId: string; // ID of the AttributeType (e.g., Color, Size)
}
