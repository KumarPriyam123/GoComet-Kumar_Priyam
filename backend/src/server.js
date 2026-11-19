import app from './app.js';
import { config } from './config/env.js';
import { startCloseAuctionsJob } from './jobs/closeAuctions.js';

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

startCloseAuctionsJob(config.closeJobIntervalMs);
