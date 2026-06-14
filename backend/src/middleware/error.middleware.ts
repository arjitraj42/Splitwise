import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[Error Handler]', err);

  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}
