import { AppError } from '../utils/AppError.js';

/**
 * Zod Request Validation Middleware
 *
 * Validates `req[source]` (`'body' | 'query' | 'params'`) against a Zod schema,
 * or accepts `{ body, query, params }` schema map.
 *
 * @param {import('zod').ZodSchema | { body?: import('zod').ZodSchema, query?: import('zod').ZodSchema, params?: import('zod').ZodSchema }} schemaOrMap
 * @param {'body'|'query'|'params'} [source='body']
 */
export function validate(schemaOrMap, source = 'body') {
  return function validateMiddleware(req, res, next) {
    try {
      if (schemaOrMap && typeof schemaOrMap.safeParse === 'function') {
        const parsed = schemaOrMap.safeParse(req[source] || {});
        if (!parsed.success) {
          const message = parsed.error.issues
            .map((issue) => `${issue.path.join('.') || source}: ${issue.message}`)
            .join('; ');
          return res.status(400).json({
            success: false,
            message,
            errors: parsed.error.issues,
          });
        }
        req[source] = parsed.data;
        return next();
      }

      if (schemaOrMap && typeof schemaOrMap === 'object') {
        for (const key of ['params', 'query', 'body']) {
          const subSchema = schemaOrMap[key];
          if (subSchema && typeof subSchema.safeParse === 'function') {
            const parsed = subSchema.safeParse(req[key] || {});
            if (!parsed.success) {
              const message = parsed.error.issues
                .map((issue) => `${issue.path.join('.') || key}: ${issue.message}`)
                .join('; ');
              return res.status(400).json({
                success: false,
                message,
                errors: parsed.error.issues,
              });
            }
            req[key] = parsed.data;
          }
        }
      }

      return next();
    } catch (err) {
      return next(new AppError(err.message || 'Validation failed', 400));
    }
  };
}

export default validate;
