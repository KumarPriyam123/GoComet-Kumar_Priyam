import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

const UNIQUE_VIOLATION = '23505';

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields are invalid',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err.code === UNIQUE_VIOLATION && err.constraint === 'rfqs_reference_id_key') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_REFERENCE_ID',
        message: 'An RFQ with this reference ID already exists',
        details: [{ field: 'referenceId', message: 'Reference ID is already used' }],
      },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Body is not valid JSON' } });
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
