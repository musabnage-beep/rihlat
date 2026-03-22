import type { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import * as authService from '../services/auth.service.js';

export async function getSettings(_req: Request, res: Response) {
  try {
    const settings = await prisma.companySettings.findFirst();
    res.json({ success: true, data: settings });
  } catch (error) {
    throw error;
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    const settings = await prisma.companySettings.upsert({
      where: { id: req.body.id ?? 'default' },
      create: req.body,
      update: req.body,
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    throw error;
  }
}

export async function getEmployees(_req: Request, res: Response) {
  try {
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: employees });
  } catch (error) {
    throw error;
  }
}

export async function createEmployee(req: Request, res: Response) {
  try {
    const result = await authService.register({
      ...req.body,
      role: 'EMPLOYEE',
    });
    res.status(201).json({ success: true, data: result.user });
  } catch (error) {
    throw error;
  }
}

export async function updateEmployee(req: Request, res: Response) {
  try {
    const employee = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        email: req.body.email,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
      },
    });
    res.json({ success: true, data: employee });
  } catch (error) {
    throw error;
  }
}

export async function deactivateEmployee(req: Request, res: Response) {
  try {
    const employee = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });
    res.json({ success: true, data: employee });
  } catch (error) {
    throw error;
  }
}
