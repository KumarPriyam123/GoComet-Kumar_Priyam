import { query } from '../config/db.js';

export async function listSuppliers() {
  const { rows } = await query('SELECT id, name FROM suppliers ORDER BY name');
  return rows;
}
