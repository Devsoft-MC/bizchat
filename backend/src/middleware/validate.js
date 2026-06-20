import { AppError } from '../lib/errors.js';

export function validate(schema, source = 'body') {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      return next(new AppError(400, 'validation_error', 'Request validation failed', details));
    }

    request[source] = result.data;
    return next();
  };
}
