import { Request, Response, NextFunction } from 'express';
import { APIError } from '../types/error.types';

export const notFound = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new APIError(404, `Not Found - ${req.originalUrl}`);
  next(error);
};