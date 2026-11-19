import { listSuppliers } from '../services/supplier.service.js';

export async function list(req, res) {
  res.json(await listSuppliers());
}
