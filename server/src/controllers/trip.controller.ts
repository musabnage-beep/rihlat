import type { Request, Response } from 'express';
import * as tripService from '../services/trip.service.js';
import * as uploadService from '../services/upload.service.js';

export async function getTrips(req: Request, res: Response) {
  try {
    const filters = {
      ...req.query,
      status: req.query.status as any ?? undefined,
    };
    const result = await tripService.getTrips(filters);
    res.json({ success: true, ...result });
  } catch (error) {
    throw error;
  }
}

export async function getFeaturedTrips(_req: Request, res: Response) {
  try {
    const trips = await tripService.getFeaturedTrips();
    res.json({ success: true, data: trips });
  } catch (error) {
    throw error;
  }
}

export async function getCategories(_req: Request, res: Response) {
  try {
    const categories = await tripService.getCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    throw error;
  }
}

export async function getTripBySlug(req: Request, res: Response) {
  try {
    const trip = await tripService.getTripBySlug(req.params.slug);
    res.json({ success: true, data: trip });
  } catch (error) {
    throw error;
  }
}

export async function createTrip(req: Request, res: Response) {
  try {
    const trip = await tripService.createTrip(req.body);
    res.status(201).json({ success: true, data: trip });
  } catch (error) {
    throw error;
  }
}

export async function updateTrip(req: Request, res: Response) {
  try {
    const trip = await tripService.updateTrip(req.params.id, req.body);
    res.json({ success: true, data: trip });
  } catch (error) {
    throw error;
  }
}

export async function updateTripStatus(req: Request, res: Response) {
  try {
    const trip = await tripService.updateTripStatus(req.params.id, req.body.status);
    res.json({ success: true, data: trip });
  } catch (error) {
    throw error;
  }
}

export async function deleteTrip(req: Request, res: Response) {
  try {
    await tripService.deleteTrip(req.params.id);
    res.json({ success: true, message: 'Trip archived successfully' });
  } catch (error) {
    throw error;
  }
}

export async function uploadImages(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: 'No files provided' });
      return;
    }

    const processedImages = await Promise.all(
      files.map((file) => uploadService.processImage(file)),
    );

    const imageData = processedImages.map((img) => ({
      url: img.url,
    }));

    const images = await tripService.addTripImages(req.params.id, imageData);
    res.status(201).json({ success: true, data: images });
  } catch (error) {
    throw error;
  }
}

export async function removeImage(req: Request, res: Response) {
  try {
    await tripService.removeTripImage(req.params.imageId);
    res.json({ success: true, message: 'Image removed successfully' });
  } catch (error) {
    throw error;
  }
}

export async function reorderImages(req: Request, res: Response) {
  try {
    const images = await tripService.reorderImages(req.params.id, req.body.imageIds);
    res.json({ success: true, data: images });
  } catch (error) {
    throw error;
  }
}
