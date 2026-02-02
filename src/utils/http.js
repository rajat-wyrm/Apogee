class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.expose = true;
  }
  static badRequest(msg, details) { return new HttpError(400, msg, details); }
  static unauthorized(msg = 'Unauthorized', details) { return new HttpError(401, msg, details); }
  static forbidden(msg = 'Forbidden', details) { return new HttpError(403, msg, details); }
  static notFound(msg = 'Not found', details) { return new HttpError(404, msg, details); }
  static conflict(msg, details) { return new HttpError(409, msg, details); }
  static unprocessable(msg, details) { return new HttpError(422, msg, details); }
  static tooMany(msg = 'Too many requests') { return new HttpError(429, msg); }
  static internal(msg = 'Internal server error') { return new HttpError(500, msg); }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ok = (res, data, meta) => res.json({ success: true, data, ...(meta ? { meta } : {}) });
const created = (res, data) => res.status(201).json({ success: true, data });
const noContent = (res) => res.status(204).end();
const paginated = (res, data, total, page, limit) =>
  res.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });

module.exports = { HttpError, asyncHandler, ok, created, noContent, paginated };
