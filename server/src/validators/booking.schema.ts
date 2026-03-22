import { z } from 'zod';

const passengerSchema = z.object({
  firstName: z.string().min(1, 'Passenger first name is required'),
  lastName: z.string().min(1, 'Passenger last name is required'),
  age: z.number().int().positive().optional(),
  idNumber: z.string().optional(),
  tierName: z.string().optional(),
});

const guestSchema = z.object({
  email: z.string().email('Invalid guest email'),
  phone: z.string().min(1, 'Guest phone is required'),
  firstName: z.string().min(1, 'Guest first name is required'),
  lastName: z.string().min(1, 'Guest last name is required'),
});

export const createBookingSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID'),
  passengers: z.array(passengerSchema).min(1, 'At least one passenger is required'),
  couponCode: z.string().optional(),
  specialRequests: z.string().optional(),
  guest: guestSchema.optional(),
});

export const lookupBookingSchema = z.object({
  bookingNumber: z.string().min(1, 'Booking number is required'),
  email: z.string().email('Invalid email address'),
});
