import { z } from 'zod';

const itineraryItemSchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
});

export const createTripSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  shortDescription: z.string().optional(),
  destination: z.string().min(1, 'Destination is required'),
  departureCity: z.string().min(1, 'Departure city is required'),
  departureDate: z.string().datetime({ message: 'Invalid departure date' }),
  returnDate: z.string().datetime({ message: 'Invalid return date' }),
  duration: z.number().int().min(1, 'Duration must be at least 1 day'),
  pricePerPerson: z.number().positive('Price must be positive'),
  childPrice: z.number().positive().optional(),
  totalSeats: z.number().int().min(1, 'Total seats must be at least 1'),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  itinerary: z.array(itineraryItemSchema).optional(),
  meetingPoint: z.string().optional(),
  meetingTime: z.string().optional(),
  terms: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export const updateTripSchema = createTripSchema.partial();

export const tripQuerySchema = z.object({
  search: z.string().optional(),
  destination: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  departureFrom: z.string().optional(),
  departureTo: z.string().optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'date_asc', 'date_desc', 'newest']).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(12).optional(),
});
