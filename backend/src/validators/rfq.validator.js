import { z } from 'zod';

const dateTime = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
const minutes = z.number().int('Must be a whole number').positive('Must be greater than 0');

export const createRfqSchema = z
  .object({
    name: z.string().trim().min(1, 'Required').max(200),
    referenceId: z.string().trim().min(1, 'Required').max(50),
    bidStartTime: dateTime,
    bidCloseTime: dateTime,
    forcedCloseTime: dateTime,
    pickupDate: z.iso.date(),
    triggerWindowMinutes: minutes,
    extensionMinutes: minutes,
    extensionTrigger: z.enum(['ANY_BID', 'ANY_RANK_CHANGE', 'L1_CHANGE']),
  })
  .superRefine((rfq, ctx) => {
    const fail = (field, message) => ctx.addIssue({ code: 'custom', path: [field], message });

    if (rfq.bidCloseTime <= rfq.bidStartTime) {
      fail('bidCloseTime', 'Bid close time must be after bid start time');
    }
    if (rfq.forcedCloseTime <= rfq.bidCloseTime) {
      fail('forcedCloseTime', 'Forced close time must be after bid close time');
    }

    // A window longer than the whole auction would treat every bid as a late bid.
    const auctionMinutes = (rfq.bidCloseTime - rfq.bidStartTime) / 60_000;
    if (rfq.triggerWindowMinutes > auctionMinutes) {
      fail('triggerWindowMinutes', 'Trigger window cannot be longer than the auction itself');
    }
  });
