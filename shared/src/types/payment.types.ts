import { PaymentStatus } from '../constants/status';

export interface PaymentInitResponse {
  paymentId: string;
  moyasarConfig: {
    publishableKey: string;
    amount: number;
    currency: string;
    description: string;
    callbackUrl: string;
  };
}

export interface PaymentInfo {
  id: string;
  status: PaymentStatus;
  method: string | null;
  amount: number;
  currency: string;
  paidAt: string | null;
  refundedAmount: number;
}
