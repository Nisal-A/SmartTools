// The only module allowed to write to the console. Everything else logs through here
// so output stays structured (one JSON object per line) and easy to filter in production.

const serialize = (value) => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
};

const write = (level, message, meta = {}) => {
  // Keep test output readable; tests assert on behaviour, not log lines.
  if (process.env.NODE_ENV === 'test') return;

  const entry = { level, time: new Date().toISOString(), message };
  for (const [key, value] of Object.entries(meta)) {
    entry[key] = serialize(value);
  }

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
};

const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

export default logger;

