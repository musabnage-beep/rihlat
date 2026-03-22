import type { Request, Response } from 'express';
import * as uploadService from '../services/upload.service.js';

export async function uploadImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file provided' });
      return;
    }

    const result = await uploadService.processImage(req.file);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    throw error;
  }
}

export async function deleteImage(req: Request, res: Response) {
  try {
    await uploadService.deleteImage(req.params.filename);
    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    throw error;
  }
}
