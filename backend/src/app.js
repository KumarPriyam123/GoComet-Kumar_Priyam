import express from 'express';
import cors from 'cors';
import rfqRoutes from './routes/rfq.routes.js';
import bidRoutes from './routes/bid.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/rfqs', rfqRoutes);
app.use('/api/rfqs/:id/bids', bidRoutes);
app.use('/api/suppliers', supplierRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
