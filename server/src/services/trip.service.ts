import { Prisma, TripStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

interface TripFilters {
  search?: string;
  destination?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  departureFrom?: string;
  departureTo?: string;
  status?: TripStatus;
  sortBy?: string;
  page?: number;
  limit?: number;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 0;

  while (true) {
    const existing = await prisma.trip.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) {
      return slug;
    }
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

export async function getTrips(filters: TripFilters) {
  const { skip, take } = parsePagination(filters.page, filters.limit);

  const where: Prisma.TripWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  } else {
    where.status = TripStatus.PUBLISHED;
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { destination: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.destination) {
    where.destination = { contains: filters.destination, mode: 'insensitive' };
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.pricePerPerson = {};
    if (filters.minPrice !== undefined) {
      where.pricePerPerson.gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      where.pricePerPerson.lte = filters.maxPrice;
    }
  }

  if (filters.departureFrom || filters.departureTo) {
    where.departureDate = {};
    if (filters.departureFrom) {
      where.departureDate.gte = new Date(filters.departureFrom);
    }
    if (filters.departureTo) {
      where.departureDate.lte = new Date(filters.departureTo);
    }
  }

  let orderBy: Prisma.TripOrderByWithRelationInput = { departureDate: 'asc' };
  switch (filters.sortBy) {
    case 'price_asc':
      orderBy = { pricePerPerson: 'asc' };
      break;
    case 'price_desc':
      orderBy = { pricePerPerson: 'desc' };
      break;
    case 'date_asc':
      orderBy = { departureDate: 'asc' };
      break;
    case 'date_desc':
      orderBy = { departureDate: 'desc' };
      break;
    case 'newest':
      orderBy = { createdAt: 'desc' };
      break;
  }

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        category: true,
      },
    }),
    prisma.trip.count({ where }),
  ]);

  return buildPaginatedResponse(trips, total, filters.page, filters.limit);
}

export async function getTripBySlug(slug: string) {
  const trip = await prisma.trip.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      pricingTiers: true,
      category: true,
    },
  });

  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  return trip;
}

export async function createTrip(data: Prisma.TripCreateInput & { categoryId?: string }) {
  const { categoryId, ...tripData } = data;

  const baseSlug = generateSlug(tripData.title);
  const slug = await ensureUniqueSlug(baseSlug);

  const createData: Prisma.TripCreateInput = {
    ...tripData,
    slug,
    availableSeats: tripData.totalSeats,
  };

  if (categoryId) {
    createData.category = { connect: { id: categoryId } };
  }

  return prisma.trip.create({
    data: createData,
    include: {
      images: true,
      pricingTiers: true,
      category: true,
    },
  });
}

export async function updateTrip(id: string, data: Prisma.TripUpdateInput & { categoryId?: string }) {
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  const { categoryId, ...updateData } = data;

  if (updateData.title && typeof updateData.title === 'string' && updateData.title !== trip.title) {
    const baseSlug = generateSlug(updateData.title);
    updateData.slug = await ensureUniqueSlug(baseSlug, id);
  }

  const prismaData: Prisma.TripUpdateInput = { ...updateData };

  if (categoryId !== undefined) {
    if (categoryId) {
      prismaData.category = { connect: { id: categoryId } };
    } else {
      prismaData.category = { disconnect: true };
    }
  }

  return prisma.trip.update({
    where: { id },
    data: prismaData,
    include: {
      images: true,
      pricingTiers: true,
      category: true,
    },
  });
}

export async function updateTripStatus(id: string, status: TripStatus) {
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  return prisma.trip.update({
    where: { id },
    data: { status },
  });
}

export async function deleteTrip(id: string) {
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  return prisma.trip.update({
    where: { id },
    data: { status: TripStatus.ARCHIVED },
  });
}

export async function getCategories() {
  return prisma.tripCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: {
          trips: { where: { status: TripStatus.PUBLISHED } },
        },
      },
    },
  });
}

export async function getFeaturedTrips() {
  return prisma.trip.findMany({
    where: {
      status: TripStatus.PUBLISHED,
      isFeatured: true,
    },
    take: 6,
    orderBy: { departureDate: 'asc' },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      category: true,
    },
  });
}

export async function addTripImages(
  tripId: string,
  files: { url: string; altText?: string; isPrimary?: boolean }[],
) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  const existingCount = await prisma.tripImage.count({ where: { tripId } });

  const images = files.map((file, index) => ({
    tripId,
    url: file.url,
    altText: file.altText ?? null,
    isPrimary: file.isPrimary ?? false,
    sortOrder: existingCount + index,
  }));

  await prisma.tripImage.createMany({ data: images });

  return prisma.tripImage.findMany({
    where: { tripId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function removeTripImage(imageId: string) {
  const image = await prisma.tripImage.findUnique({ where: { id: imageId } });
  if (!image) {
    throw new NotFoundError('Image not found');
  }

  await prisma.tripImage.delete({ where: { id: imageId } });
}

export async function reorderImages(tripId: string, imageIds: string[]) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  const updates = imageIds.map((id, index) =>
    prisma.tripImage.update({
      where: { id },
      data: { sortOrder: index },
    }),
  );

  await prisma.$transaction(updates);

  return prisma.tripImage.findMany({
    where: { tripId },
    orderBy: { sortOrder: 'asc' },
  });
}
