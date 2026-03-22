import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.service.js';

export async function getUserNotifications(req: Request, res: Response) {
  try {
    const { page, limit } = req.query as any;
    const result = await notificationService.getUserNotifications(req.user!.id, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    throw error;
  }
}

export async function markAsRead(req: Request, res: Response) {
  try {
    await notificationService.markAsRead(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    throw error;
  }
}

export async function markAllAsRead(req: Request, res: Response) {
  try {
    await notificationService.markAllAsRead(req.user!.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    throw error;
  }
}

export async function getUnreadCount(req: Request, res: Response) {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.json({ success: true, data: { count } });
  } catch (error) {
    throw error;
  }
}

export async function sendNotification(req: Request, res: Response) {
  try {
    const { userId, type, title, body, metadata } = req.body;
    const notification = await notificationService.sendNotification(
      userId,
      type,
      title,
      body,
      metadata,
    );
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    throw error;
  }
}

export async function broadcastNotification(req: Request, res: Response) {
  try {
    const { type, title, body, metadata } = req.body;
    const notification = await notificationService.broadcastNotification(
      type,
      title,
      body,
      metadata,
    );
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    throw error;
  }
}
