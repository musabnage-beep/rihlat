import { BookingStatus } from '../constants/status';

export interface BookingRequest {
  tripId: string;
  passengers: PassengerInput[];
  couponCode?: string;
  specialRequests?: string;
  guest?: GuestInfo;
}

export interface PassengerInput {
  firstName: string;
  lastName: string;
  age?: number;
  idNumber?: string;
  tierName: string;
}

export interface GuestInfo {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}

export interface BookingSummary {
  id: string;
  bookingNumber: string;
  tripTitle: string;
  tripDestination: string;
  tripDepartureDate: string;
  status: BookingStatus;
  numberOfPersons: number;
  finalAmount: number;
  paymentStatus: string | null;
  createdAt: string;
}

export interface BookingDetail extends BookingSummary {
  totalAmount: number;
  discountAmount: number;
  specialRequests: string | null;
  passengers: {
    id: string;
    firstName: string;
    lastName: string;
    age: number | null;
    tierName: string | null;
  }[];
  coupon: { code: string; discountPercent: number | null; discountAmount: number | null } | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
}
