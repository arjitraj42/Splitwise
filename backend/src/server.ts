import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());

// Mount central router under both /api and / to satisfy all routing conventions
app.use('/api', routes);
app.use('/', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Central Error Handler Middleware
app.use(errorMiddleware as any);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});

export default app;
export { app };
