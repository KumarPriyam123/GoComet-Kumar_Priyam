import { submitBid } from '../services/bid.service.js';
import { getRankedBids } from '../services/rfq.service.js';
import { parseRfqId } from '../utils/params.js';

export async function create(req, res) {
  const result = await submitBid(parseRfqId(req), req.body);
  res.status(201).json(result);
}

export async function list(req, res) {
  res.json(await getRankedBids(parseRfqId(req)));
}
