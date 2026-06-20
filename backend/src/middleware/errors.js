import { AppError } from '../lib/errors.js';

export function notFoundHandler(_request, _response, next) {
  next(new AppError(404, 'route_not_found', 'API route not found'));
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof AppError) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.details && { details: error.details }) }
    });
  }

  if (error?.code === '23505') {
    return response.status(409).json({
      error: { code: 'duplicate_value', message: 'A record with this value already exists' }
    });
  }

  if (error?.code === '23503') {
    return response.status(400).json({
      error: { code: 'invalid_reference', message: 'A referenced record does not exist' }
    });
  }

  console.error(error);
  return response.status(500).json({
    error: { code: 'internal_error', message: 'An unexpected server error occurred' }
  });
}
