import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { notFound } from '../middlewares/not-found';
import { errorHandler } from '../middlewares/error-handler';
import { RateLimiter } from '../middlewares/rate-limitter';
import gptRouter from '../routes/gpt.route';
import path from 'path';
import { CONSTANTS } from '../utils/constants';
const app = express();
const limiter = new RateLimiter({
  windowMs: CONSTANTS.RATE_LIMIT_WINDOW_MS,
  maxRequests: CONSTANTS.RATE_LIMIT_MAX
});
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

app.use(limiter.middleware);
app.use('/api', gptRouter);
app.use(notFound);
app.use(errorHandler);
export default app;
