import { Country } from '@prisma/client';
import { Exclude, Expose, Transform } from 'class-transformer';

export class CountryEntity {
  id: string;
  countryName: string;
}
export class AddressEntity {
  id: string;
  addressLine1: string;
  addressLine2: string;
  phoneNumber: string;
  city: string;
  region: string;
  postalCode: string;
  isDefault: boolean;

  @Exclude()
  userId: string;
  @Exclude()
  countryId: string;

  @Transform(({ value }) => value?.countryName, { toPlainOnly: true })
  @Expose()
  country: Country;

  // Additional transformed properties
  @Expose()
  get fullAddress(): string {
    const addressComponents = [
      this.addressLine1,
      this.addressLine2,
      this.city,
      this.region,
      this.postalCode,
    ].filter(Boolean);
    return addressComponents.join(', ');
  }

  // @Expose({ name: 'country' })
  // get countryName(): string | null {
  //   return this.country?.countryName ?? null;
  // }

  // @Transform(({ obj }) => {
  //   const address = [obj.addressLine1];
  //   if (obj.addressLine2) address.push(obj.addressLine2);
  //   address.push(obj.city, obj.region);
  //   if (obj.postalCode) address.push(obj.postalCode);
  //   return address;
  // })
  // addressComponents: string[];

  constructor(partial: Partial<AddressEntity>) {
    Object.assign(this, partial);
  }
}
