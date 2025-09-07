export class EnrollDto {
  course_type: string; // CourseType enum
  full_name: string;
  email: string;
  phone: string;
  address: string;
  date_of_birth: string; // ISO string
  experience_level: string; // ExperienceLevel enum
  acting_goals: string;

  // Rules & Terms
  acknowledged: boolean;
  agreed: boolean;
  accepted: boolean;

  // Digital Signature
  signature_full_name: string;
  signature: string;
  signature_date: string; // ISO string

  // Payment
  payment_type: string; // PaymentType enum
  payment_status: string; // PaymentStatus enum
  payment_method: string;
  account_holder?: string;
  card_number?: string;
  card_expiry?: string;
  card_cvc?: string;
}