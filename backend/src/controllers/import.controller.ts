import { Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { importService } from '../config/services';

export const importCSV = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }
  const groupId = Number(req.body.groupId || req.query.groupId);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'groupId is required to associate imported expenses' });
  }

  const result = await importService.importCSV(groupId, req.file.path, req.user!.id);
  res.status(201).json(result);
});

export const getImportReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const batchId = Number(req.params.id);
  if (isNaN(batchId)) {
    return res.status(400).json({ error: 'Valid batch ID is required' });
  }

  const report = await importService.getBatchReport(batchId);
  res.json(report);
});

export const listAnomalies = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const batchId = Number(req.params.id);
  if (isNaN(batchId)) {
    return res.status(400).json({ error: 'Valid batch ID is required' });
  }

  const anomalies = await importService.listBatchAnomalies(batchId);
  res.json(anomalies);
});

export const resolveAnomaly = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const anomalyId = Number(req.params.anomalyId);
  const { action, groupId } = req.body;

  if (isNaN(anomalyId)) {
    return res.status(400).json({ error: 'Valid anomaly ID is required' });
  }
  if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
    return res.status(400).json({ error: 'Action must be either APPROVED or REJECTED' });
  }
  if (action === 'APPROVED' && !groupId) {
    return res.status(400).json({ error: 'groupId is required to associate resolved expense' });
  }

  const resolved = await importService.resolveAnomaly(anomalyId, action, Number(groupId));
  res.json(resolved);
});
