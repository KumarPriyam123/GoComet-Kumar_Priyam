import { Router } from 'express';
import * as supplierController from '../controllers/supplier.controller.js';

const router = Router();

router.get('/', supplierController.list);

export default router;
