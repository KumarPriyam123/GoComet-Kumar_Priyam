import { z } from 'zod';
import { hasAtMostTwoDecimals } from '../utils/money.js';

const charge = z
  .number({ error: 'Must be a number' })
  .min(0, 'Cannot be negative')
  .max(9_999_999_999, 'Too large')
  .refine(hasAtMostTwoDecimals, 'At most 2 decimal places');

export const submitBidSchema = z
  .object({
    supplierId: z.number().int().positive(),
    carrierName: z.string().trim().min(1, 'Required').max(100),
    freightCharges: charge,
    originCharges: charge,
    destinationCharges: charge,
    transitTimeDays: z.number().int('Must be a whole number').positive('Must be greater than 0'),
    quoteValidityDate: z.iso.date(),
  })
  .refine((bid) => bid.freightCharges + bid.originCharges + bid.destinationCharges > 0, {
    path: ['freightCharges'],
    message: 'Total price must be greater than 0',
  });
