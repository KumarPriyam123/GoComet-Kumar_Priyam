import { Router } from 'express';
import * as rfqController from '../controllers/rfq.controller.js';
import { validateBody } from '../middlewares/validate.js';
import { createRfqSchema } from '../validators/rfq.validator.js';

const router = Router();

router.post('/', validateBody(createRfqSchema), rfqController.create);
router.get('/', rfqController.list);
router.get('/:id', rfqController.getOne);
router.get('/:id/activity', rfqController.getActivity);

export default router;
