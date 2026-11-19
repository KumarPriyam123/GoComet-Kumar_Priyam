import { AppError } from './AppError.js';

export function parseRfqId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw AppError.notFound('RFQ not found');
  return id;
}
