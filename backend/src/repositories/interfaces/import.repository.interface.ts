import { ImportBatch, ImportAnomaly } from '@prisma/client';

export interface IImportRepository {
  createBatch(filename: string, createdBy: number, normalizations?: string): Promise<ImportBatch>;
  findBatchById(id: number): Promise<(ImportBatch & { anomalies: ImportAnomaly[]; expenses: any[] }) | null>;
  createAnomalies(
    anomalies: {
      batchId: number;
      rowNumber: number;
      rowData: string;
      detectorName: string;
      suggestedAction: string;
      status?: string;
    }[]
  ): Promise<any>;
  findAnomaliesByBatch(batchId: number): Promise<ImportAnomaly[]>;
  findAnomalyById(id: number): Promise<ImportAnomaly | null>;
  resolveAnomaly(anomalyId: number, status: string): Promise<ImportAnomaly>;
}
