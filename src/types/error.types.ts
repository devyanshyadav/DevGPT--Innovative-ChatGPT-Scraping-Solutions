export interface IAPIError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
  }
  
  // src/middleware/errorTypes.ts
  export class APIError extends Error implements IAPIError {
    public statusCode: number;
    public status: string;
    public isOperational: boolean;
  
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }