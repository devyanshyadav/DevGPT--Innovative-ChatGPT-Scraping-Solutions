import { Request, Response, NextFunction } from 'express';
import { APIError } from '../types/error.types';

interface RateLimitInfo {
  count: number;
  lastReset: number;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private requests: Map<string, RateLimitInfo>;

  constructor(options: {
    windowMs?: number;    // Time window in milliseconds (default: 5 minutes)
    maxRequests?: number; // Max requests per IP in the time window (default: 100)
  } = {}) {
    this.windowMs = options.windowMs || 5 * 60 * 1000; // 5 minutes
    this.maxRequests = options.maxRequests || 100;      // 100 requests
    this.requests = new Map();

    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanOldRequests(), 5 * 60 * 1000);
  }

  private cleanOldRequests(): void {
    const now = Date.now();
    for (const [ip, info] of this.requests.entries()) {
      if (now - info.lastReset > this.windowMs) {
        this.requests.delete(ip);
      }
    }
  }

  public middleware = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const requestInfo = this.requests.get(ip);

      // If no previous requests or window expired, reset the counter
      if (!requestInfo || now - requestInfo.lastReset > this.windowMs) {
        this.requests.set(ip, {
          count: 1,
          lastReset: now
        });

        // Set headers
        this.setHeaders(res, 1);
        return next();
      }

      // Increment request count
      requestInfo.count++;

      // Set headers
      this.setHeaders(res, requestInfo.count);

      // Check if over limit
      if (requestInfo.count > this.maxRequests) {
        const timeLeft = Math.ceil(
          (requestInfo.lastReset + this.windowMs - now) / 1000
        );
        res.set('Retry-After', timeLeft.toString());
        throw new APIError(
          429,
          `Too many requests. Please try again after ${timeLeft} seconds.`
        );
      }

      next();
    } catch (error) {
      if (error instanceof APIError) {
        next(error);
      } else {
        next(new APIError(500, 'Rate limiter error'));
      }
    }
  };

  private setHeaders(res: Response, currentCount: number): void {
    res.set({
      'X-RateLimit-Limit': this.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(
        this.maxRequests - currentCount,
        0
      ).toString(),
      'X-RateLimit-Reset': new Date(
        Date.now() + this.windowMs
      ).toUTCString()
    });
  }
}
