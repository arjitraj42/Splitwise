import { Router } from 'express';
import multer from 'multer';
import * as os from 'os';
import * as path from 'path';
import { importCSV, getImportReport, listAnomalies, resolveAnomaly } from '../controllers/import.controller';
import { authenticate } from '../middleware/auth.middleware';

// Use OS temp directory for file uploads
const upload = multer({ dest: path.join(os.tmpdir(), 'sharedsplit-uploads') });
const router = Router();

router.use(authenticate as any);

router.post('/csv', upload.single('file'), importCSV);
router.get('/:id/report', getImportReport);
router.get('/:id/anomalies', listAnomalies);
router.patch('/anomalies/:anomalyId/resolve', resolveAnomaly);

export default router;
