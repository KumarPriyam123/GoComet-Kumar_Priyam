export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Retrying…');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // No JSON body means the request never reached our API (e.g. the dev proxy failed).
    if (!body) throw new ApiError(res.status, 'NETWORK_ERROR', 'Could not reach the server. Retrying…');
    const err = body.error ?? {};
    throw new ApiError(res.status, err.code, err.message ?? 'Something went wrong', err.details);
  }
  return body;
}

export const api = {
  listRfqs: () => request('/rfqs'),
  getRfq: (id) => request(`/rfqs/${id}`),
  getActivity: (id) => request(`/rfqs/${id}/activity`),
  getSuppliers: () => request('/suppliers'),
  createRfq: (data) => request('/rfqs', { method: 'POST', body: JSON.stringify(data) }),
  submitBid: (id, data) =>
    request(`/rfqs/${id}/bids`, { method: 'POST', body: JSON.stringify(data) }),
};
