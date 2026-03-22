import { TripStatus } from '../constants/status';

export interface TripSummary {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  destination: string;
  departureDate: string;
  returnDate: string;
  duration: number;
  pricePerPerson: number;
  availableSeats: number;
  totalSeats: number;
  isFeatured: boolean;
  status: TripStatus;
  primaryImage: string | null;
  category: { id: string; name: string } | null;
}

export interface TripDetail extends TripSummary {
  description: string;
  departureCity: string;
  childPrice: number | null;
  inclusions: string[];
  exclusions: string[];
  itinerary: ItineraryDay[] | null;
  meetingPoint: string | null;
  meetingTime: string | null;
  terms: string | null;
  images: TripImage[];
  pricingTiers: PricingTier[];
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
}

export interface TripImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  description: string | null;
  maxQuantity: number | null;
}

export interface TripCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  tripCount?: number;
}

export interface TripFilters {
  search?: string;
  destination?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  departureFrom?: string;
  departureTo?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'date_asc' | 'date_desc' | 'popular';
  page?: number;
  limit?: number;
}
