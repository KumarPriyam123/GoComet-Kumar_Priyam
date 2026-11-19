import * as rfqService from '../services/rfq.service.js';
import { parseRfqId } from '../utils/params.js';

export async function create(req, res) {
  const rfq = await rfqService.createRfq(req.body);
  res.status(201).json(rfq);
}

export async function list(req, res) {
  res.json(await rfqService.listRfqs());
}

export async function getOne(req, res) {
  res.json(await rfqService.getRfqDetails(parseRfqId(req)));
}

export async function getActivity(req, res) {
  res.json(await rfqService.getActivity(parseRfqId(req)));
}
