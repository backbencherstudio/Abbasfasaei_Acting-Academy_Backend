export class UpdatePersonalInfoDto {
  fullName?: string;
  phone?: string;
  dateOfBirth?: Date;
  experienceLevel?: string;
  about?: string;
  address?: {
    country?: string;
    city?: string;
    address?: string;
  };
}