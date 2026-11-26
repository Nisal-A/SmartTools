import dotenv from 'dotenv';

dotenv.config();

const NODE_ENVS = ['development', 'production', 'test'];
const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/smart_tools_db';
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';
export const TARGET_DB_NAME = 'smart_tools_db';

export const ALWAYS_REQUIRED_ENV_KEYS = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CLIENT_URL',
];

export const PRODUCTION_ONLY_REQUIRED_ENV_KEYS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'KEEPALIVE_SECRET',
];

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

/**
 * Strips surrounding quotes, `<url>` brackets, or Markdown `[label](url)` formatting
 * when environment variables are pasted from documentation.
 */
export const unwrapEnvUrl = (raw = '') => {
  let cleaned = String(raw || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();

  const mdMatch = cleaned.match(/^\[[^\]]*\]\(([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^)\s]+)\)$/);
  if (mdMatch) {
    cleaned = mdMatch[1].trim();
  } else if (cleaned.startsWith('<') && cleaned.endsWith('>')) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
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
    .map((item) => unwrapEnvUrl(item))
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
 * Checks whether a MongoDB connection string explicitly specifies `/smart_tools_db`
 * in its path segment before `?` (never returns or logs the URI itself).
 *
 * @param {string} uri
 * @param {string} [expectedDb='smart_tools_db']
 * @returns {boolean}
 */
export function hasExplicitMongoDbName(uri, expectedDb = TARGET_DB_NAME) {
  if (typeof uri !== 'string' || !uri.trim()) return false;
  const match = uri.trim().match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/i);
  if (!match) return false;
  const dbSegment = (match[1] || '').trim();
  return dbSegment === expectedDb;
}

/**
 * Pure environment validation helper covering SmartTools platform & Render production rules.
 * Never includes secret values in `errors`, `missingKeys`, or `warnings`.
 *
 * @param {Record<string, string | undefined>} source
 * @param {{ requireMongoUri?: boolean, strictProduction?: boolean }} [options]
 * @returns {{ env: object, errors: string[], missingKeys: string[], warnings: string[] }}
 */
export const validateEnv = (source = {}, options = {}) => {
  const errors = [];
  const missingKeys = [];
  const warnings = [];

  const nodeEnv = readString(source, 'NODE_ENV') || 'development';
  if (!NODE_ENVS.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')} (received "${nodeEnv}")`);
  }

  const isProd = nodeEnv === 'production' || options.strictProduction === true;

  // Check required keys
  const rawMongoUri = unwrapEnvUrl(readString(source, 'MONGODB_URI'));
  const rawJwtAccess = readString(source, 'JWT_ACCESS_SECRET');
  const rawJwtRefresh = readString(source, 'JWT_REFRESH_SECRET');
  const rawClientUrl =
    readString(source, 'CLIENT_URL') ||
    readString(source, 'FRONTEND_ORIGIN') ||
    readString(source, 'CLIENT_ORIGIN');

  if (isProd) {
    if (!rawMongoUri) missingKeys.push('MONGODB_URI');
    if (!rawJwtAccess) missingKeys.push('JWT_ACCESS_SECRET');
    if (!rawJwtRefresh) missingKeys.push('JWT_REFRESH_SECRET');
    if (!readString(source, 'CLIENT_URL')) missingKeys.push('CLIENT_URL');

    for (const key of PRODUCTION_ONLY_REQUIRED_ENV_KEYS) {
      if (!readString(source, key)) {
        if (options.strictProduction === true) {
          missingKeys.push(key);
        } else {
          warnings.push(
            `Optional production key ${key} is not set (related feature such as Cloudinary upload or ping auth key will be disabled until configured).`
          );
        }
      }
    }

    if (missingKeys.length > 0) {
      errors.push(`Missing required production environment variables: ${missingKeys.join(', ')}`);
    }
  }

  let mongoUri = rawMongoUri;
  if (rawMongoUri === '') {
    if (options.requireMongoUri && !missingKeys.includes('MONGODB_URI')) {
      errors.push('MONGODB_URI is required');
    } else if (!isProd) {
      mongoUri = DEFAULT_MONGODB_URI;
    }
  } else if (!/^mongodb(\+srv)?:\/\//.test(rawMongoUri)) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  } else if (!hasExplicitMongoDbName(rawMongoUri, TARGET_DB_NAME)) {
    warnings.push(
      `MONGODB_URI does not explicitly include "/${TARGET_DB_NAME}" in its path; Mongoose will enforce dbName="${TARGET_DB_NAME}" via connection options.`
    );
  }

  const clientOrigin = parseOriginList(rawClientUrl || DEFAULT_CLIENT_ORIGIN, errors);

  const numeric = Object.fromEntries(
    Object.entries(NUMERIC_VARS).map(([name, rule]) => [
      name,
      parseInteger(source, name, rule, errors),
    ])
  );

  const env = Object.freeze({
    NODE_ENV: nodeEnv,
    MONGODB_URI: mongoUri,
    CLIENT_URL: clientOrigin,
    CLIENT_ORIGIN: clientOrigin,
    FRONTEND_ORIGIN: clientOrigin,
    JWT_ACCESS_SECRET: rawJwtAccess || 'smarttools-dev-jwt-access-secret-2026',
    JWT_REFRESH_SECRET: rawJwtRefresh || 'smarttools-dev-jwt-refresh-secret-2026',
    KEEPALIVE_SECRET: readString(source, 'KEEPALIVE_SECRET'),
    CLOUDINARY_CLOUD_NAME: readString(source, 'CLOUDINARY_CLOUD_NAME'),
    CLOUDINARY_API_KEY: readString(source, 'CLOUDINARY_API_KEY'),
    CLOUDINARY_API_SECRET: readString(source, 'CLOUDINARY_API_SECRET'),
    ...numeric,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
  });

  return { env, errors, missingKeys, warnings };
};

const validation = validateEnv(process.env, { requireMongoUri: false });

for (const warning of validation.warnings) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(`[SmartTools Env Warning] ${warning}`);
  }
}

if (validation.env.isProduction && validation.errors.length > 0) {
  // Fail fast in production without ever printing secret values
  console.error(
    '[SmartTools Env Fatal] Production environment validation failed:\n' +
    validation.errors.map((err) => `  - ${err}`).join('\n')
  );
  process.exit(1);
}

export default validation.env;
