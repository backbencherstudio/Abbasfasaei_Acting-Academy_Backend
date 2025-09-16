export class PaymentDto {
  transactionId: string;
  paymentType: string; // PaymentType enum
  paymentStatus: string; // PaymentStatus enum
  paymentDate: string; // ISO string
  amount: number;
}
