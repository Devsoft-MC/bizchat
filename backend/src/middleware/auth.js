import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export function authenticate(request, _response, next) {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'authentication_required', 'A valid bearer token is required'));
  }

  try {
    request.auth = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    return next();
  } catch {
    return next(new AppError(401, 'invalid_token', 'The access token is invalid or expired'));
  }
}

export function authorize(...roles) {
  return (request, _response, next) => {
    if (!roles.includes(request.auth.role)) {
      return next(new AppError(403, 'forbidden', 'You do not have permission to perform this action'));
    }
    return next();
  };
}
