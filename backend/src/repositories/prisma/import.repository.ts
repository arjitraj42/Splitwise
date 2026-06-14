import { ImportBatch, ImportAnomaly } from '@prisma/client';
import { IImportRepository } from '../interfaces/import.repository.interface';
import prisma from '../../config/prisma';

export class PrismaImportRepository implements IImportRepository {
  async createBatch(filename: string, createdBy: number, normalizations?: string): Promise<ImportBatch> {
    return prisma.importBatch.create({
      data: {
        filename,
        createdBy,
        normalizations,
      },
    });
  }

  async findBatchById(id: number): Promise<(ImportBatch & { anomalies: ImportAnomaly[]; expenses: any[] }) | null> {
    return prisma.importBatch.findUnique({
      where: { id },
      include: {
        anomalies: true,
        expenses: {
          select: { id: true, description: true, date: true, amountInInr: true, currency: true, amount: true },
        },
      },
    }) as any;
  }

  async createAnomalies(
    anomalies: {
      batchId: number;
      rowNumber: number;
      rowData: string;
      detectorName: string;
      suggestedAction: string;
      status?: string;
    }[]
  ): Promise<any> {
    return prisma.importAnomaly.createMany({
      data: anomalies.map((a) => ({
        batchId: a.batchId,
        rowNumber: a.rowNumber,
        rowData: a.rowData,
        detectorName: a.detectorName,
        suggestedAction: a.suggestedAction,
        status: a.status || 'PENDING',
      })),
    });
  }

  async findAnomaliesByBatch(batchId: number): Promise<ImportAnomaly[]> {
    return prisma.importAnomaly.findMany({
      where: { batchId },
      orderBy: { rowNumber: 'asc' },
    });
  }

  async findAnomalyById(id: number): Promise<ImportAnomaly | null> {
    return prisma.importAnomaly.findUnique({ where: { id } });
  }

  async resolveAnomaly(anomalyId: number, status: string): Promise<ImportAnomaly> {
    return prisma.importAnomaly.update({
      where: { id: anomalyId },
      data: {
        status,
        resolvedAt: new Date(),
      },
    });
  }
}
