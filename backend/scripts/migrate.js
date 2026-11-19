import { pool } from '../src/config/db.js';
import { migrate } from '../src/config/migrate.js';

migrate()
  .then(() => console.log('migrations up to date'))
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
