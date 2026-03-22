import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { BadRequestError } from '../utils/errors.js';

const MAX_WIDTH = 1200;
const THUMBNAIL_WIDTH = 400;

export async function processImage(file: Express.Multer.File) {
  if (!file) {
    throw new BadRequestError('No file provided');
  }

  const inputPath = file.path;
  const ext = path.extname(file.filename);
  const baseName = path.basename(file.filename, ext);

  const outputFilename = `${baseName}.webp`;
  const thumbnailFilename = `${baseName}-thumb.webp`;

  const outputPath = path.join(env.UPLOAD_DIR, outputFilename);
  const thumbnailPath = path.join(env.UPLOAD_DIR, thumbnailFilename);

  try {
    await sharp(inputPath)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);

    await sharp(inputPath)
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(thumbnailPath);

    if (inputPath !== outputPath) {
      await fs.unlink(inputPath).catch(() => {});
    }

    return {
      url: `/uploads/${outputFilename}`,
      thumbnailUrl: `/uploads/${thumbnailFilename}`,
    };
  } catch (error) {
    await fs.unlink(inputPath).catch(() => {});
    throw new BadRequestError('Failed to process image');
  }
}

export async function deleteImage(filename: string) {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);

  const filePath = path.join(env.UPLOAD_DIR, filename);
  const thumbPath = path.join(env.UPLOAD_DIR, `${baseName}-thumb${ext}`);
  const webpPath = path.join(env.UPLOAD_DIR, `${baseName}.webp`);
  const webpThumbPath = path.join(env.UPLOAD_DIR, `${baseName}-thumb.webp`);

  await Promise.allSettled([
    fs.unlink(filePath),
    fs.unlink(thumbPath),
    fs.unlink(webpPath),
    fs.unlink(webpThumbPath),
  ]);
}
