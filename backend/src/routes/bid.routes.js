import { Router } from 'express';
import * as bidController from '../controllers/bid.controller.js';
import { validateBody } from '../middlewares/validate.js';
import { submitBidSchema } from '../validators/bid.validator.js';

// Mounted at /api/rfqs/:id/bids
const router = Router({ mergeParams: true });

router.post('/', validateBody(submitBidSchema), bidController.create);
router.get('/', bidController.list);

export default router;
