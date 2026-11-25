import dotenv from 'dotenv';

dotenv.config();

const NODE_ENVS = ['development', 'production', 'test'];
const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/smart_tools_db';
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';

const NUMERIC_VARS = {
  PORT: { default: 5000, min: 1, max: 65535 },
  FETCH_TIMEOUT_MS: { default: 10000, min: 1 },
  FETCH_MAX_BYTES: { default: 2097152, min: 1 },
  FETCH_MAX_REDIRECTS: { default: 5, min: 0 },
  RATE_LIMIT_ANALYZE_PER_15MIN: { default: 10, min: 1 },
  RATE_LIMIT_GLOBAL_PER_15MIN: { default: 200, min: 1 },
};

const readString = (source, name) => {
  const value = source?.[name];
  return typeof value === 'string' ? value.trim() : '';
};

const parseInteger = (source, name, rule, errors) => {
  const raw = readString(source, name);
  if (raw === '') return rule.default;

  const value = Number(raw);
  const max = rule.max ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isInteger(value) || value < rule.min || value > max) {
    errors.push(
      `${name} must be an integer between ${rule.min} and ${max} (received "${raw}")`
    );
    return rule.default;
  }
  return value;
};

const parseOriginList = (raw, errors) => {
  const parts = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) return DEFAULT_CLIENT_ORIGIN;

  const normalized = [];
  for (const part of parts) {
    try {
      const url = new URL(part);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('bad protocol');
      }
      normalized.push(url.origin);
    } catch {
      errors.push(
        `CLIENT_URL / CLIENT_ORIGIN must contain valid http(s) origin(s) such as ${DEFAULT_CLIENT_ORIGIN} (received "${part}")`
      );
    }
  }

  return normalized.length > 0 ? normalized.join(',') : DEFAULT_CLIENT_ORIGIN;
};

/**
 * Pure environment validation helper covering SmartTools platform & SEO Analyzer config.
 *
 * @param {Record<string, string | undefined>} source
 * @param {{ requireMongoUri?: boolean }} [options]
 * @returns {{ env: object, errors: string[] }}
 */
export const validateEnv = (source = {}, options = {}) => {
  const errors = [];

  const nodeEnv = readString(source, 'NODE_ENV') || 'development';
  if (!NODE_ENVS.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')} (received "${nodeEnv}")`);
  }

  const rawMongoUri = readString(source, 'MONGODB_URI');
  let mongoUri = rawMongoUri;
  if (rawMongoUri === '') {
    if (options.requireMongoUri) {
      errors.push('MONGODB_URI is required');
    } else {
      mongoUri = DEFAULT_MONGODB_URI;
    }
  } else if (!/^mongodb(\+srv)?:\/\//.test(rawMongoUri)) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  const rawOrigin =
    readString(source, 'CLIENT_URL') ||
    readString(source, 'FRONTEND_ORIGIN') ||
    readString(source, 'CLIENT_ORIGIN') ||
    DEFAULT_CLIENT_ORIGIN;
  const clientOrigin = parseOriginList(rawOrigin, errors);

  const numeric = Object.fromEntries(
    Object.entries(NUMERIC_VARS).map(([name, rule]) => [
      name,
      parseInteger(source, name, rule, errors),
    ])
  );

  const env = Object.freeze({
    NODE_ENV: nodeEnv,
    MONGODB_URI: mongoUri,
    CLIENT_ORIGIN: clientOrigin,
    FRONTEND_ORIGIN: clientOrigin,
    JWT_ACCESS_SECRET:
      readString(source, 'JWT_ACCESS_SECRET') || 'smarttools-dev-jwt-access-secret-2026',
    JWT_REFRESH_SECRET:
      readString(source, 'JWT_REFRESH_SECRET') || 'smarttools-dev-jwt-refresh-secret-2026',
    ...numeric,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
  });

  return { env, errors };
};

const { env } = validateEnv(process.env, { requireMongoUri: false });

export default env;
