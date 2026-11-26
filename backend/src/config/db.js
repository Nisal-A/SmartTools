import mongoose from 'mongoose';

/**
 * MongoDB Connection Manager (`smart_tools_db`) with Automatic In-Memory
 * Mongoose Storage Engine Fallback for Local Testing Without a Running `mongod`.
 *
 * When a real MongoDB instance is reachable at `MONGODB_URI`, Mongoose connects
 * natively. When running tests in an environment where `127.0.0.1:27017` is offline,
 * `enableInMemoryMongooseEngine()` patches registered Mongoose models with a
 * transactional, index-enforcing in-memory collection store so all Mongoose
 * queries, atomic counters, unique compound indexes, and transactions run identically.
 */

export const DEFAULT_DB_NAME = 'smart_tools_db';

let isConnected = false;
let isInMemoryMode = false;
let activeDbName = DEFAULT_DB_NAME;
let dbShutdownHooksRegistered = false;

// In-memory store keyed by collection name -> Map<_id_string, plainDoc>
const memoryStore = new Map();
const patchedModels = new Set();

function cloneValue(val) {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return new Date(val.getTime());
  if (val instanceof mongoose.Types.ObjectId) {
    return new mongoose.Types.ObjectId(String(val));
  }
  if (Array.isArray(val)) return val.map(cloneValue);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = cloneValue(v);
    }
    return out;
  }
  return val;
}

function getCollectionMap(collectionName) {
  if (!memoryStore.has(collectionName)) {
    memoryStore.set(collectionName, new Map());
  }
  return memoryStore.get(collectionName);
}

function getNestedValue(obj, pathStr) {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = pathStr.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (
    (a instanceof mongoose.Types.ObjectId || typeof a === 'string') &&
    (b instanceof mongoose.Types.ObjectId || typeof b === 'string')
  ) {
    return String(a) === String(b);
  }
  return false;
}

function matchesCondition(docValue, cond) {
  if (cond && typeof cond === 'object' && !(cond instanceof Date) && !(cond instanceof mongoose.Types.ObjectId) && !(cond instanceof RegExp)) {
    if ('$regex' in cond) {
      const flags = cond.$options || '';
      const regex = cond.$regex instanceof RegExp ? cond.$regex : new RegExp(cond.$regex, flags);
      return regex.test(String(docValue ?? ''));
    }
    if ('$in' in cond && Array.isArray(cond.$in)) {
      return cond.$in.some((item) => valuesEqual(docValue, item));
    }
    if ('$nin' in cond && Array.isArray(cond.$nin)) {
      return !cond.$nin.some((item) => valuesEqual(docValue, item));
    }
    if ('$ne' in cond) {
      return !valuesEqual(docValue, cond.$ne);
    }
    const cmpVal = docValue instanceof Date ? docValue.getTime() : docValue;
    if ('$gte' in cond) {
      const target = cond.$gte instanceof Date ? cond.$gte.getTime() : new Date(cond.$gte).getTime() || cond.$gte;
      if (!(cmpVal >= target)) return false;
    }
    if ('$gt' in cond) {
      const target = cond.$gt instanceof Date ? cond.$gt.getTime() : new Date(cond.$gt).getTime() || cond.$gt;
      if (!(cmpVal > target)) return false;
    }
    if ('$lte' in cond) {
      const target = cond.$lte instanceof Date ? cond.$lte.getTime() : new Date(cond.$lte).getTime() || cond.$lte;
      if (!(cmpVal <= target)) return false;
    }
    if ('$lt' in cond) {
      const target = cond.$lt instanceof Date ? cond.$lt.getTime() : new Date(cond.$lt).getTime() || cond.$lt;
      if (!(cmpVal < target)) return false;
    }
    return true;
  }

  if (cond instanceof RegExp) {
    return cond.test(String(docValue ?? ''));
  }

  return valuesEqual(docValue, cond);
}

function matchesFilter(doc, filter = {}) {
  if (!filter || typeof filter !== 'object') return true;

  for (const [key, cond] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(cond)) {
      if (!cond.some((subFilter) => matchesFilter(doc, subFilter))) {
        return false;
      }
      continue;
    }
    if (key === '$and' && Array.isArray(cond)) {
      if (!cond.every((subFilter) => matchesFilter(doc, subFilter))) {
        return false;
      }
      continue;
    }
    const docValue = key.includes('.') ? getNestedValue(doc, key) : doc[key];
    if (!matchesCondition(docValue, cond)) {
      return false;
    }
  }

  return true;
}

function enforceUniqueIndexes(Model, candidateDoc, excludeIdStr = null) {
  const collectionName = Model.collection.name;
  const colMap = getCollectionMap(collectionName);
  const indexes = Model.schema.indexes();

  for (const [fields, options] of indexes) {
    if (!options || !options.unique) continue;
    const fieldKeys = Object.keys(fields);

    for (const [existingId, existingDoc] of colMap.entries()) {
      if (excludeIdStr && existingId === excludeIdStr) continue;
      const allMatch = fieldKeys.every((k) => {
        const a = getNestedValue(candidateDoc, k);
        const b = getNestedValue(existingDoc, k);
        return a !== undefined && b !== undefined && valuesEqual(a, b);
      });
      if (allMatch) {
        const dupErr = new Error(
          `E11000 duplicate key error collection: smart_tools_db.${collectionName} index: ${fieldKeys.join('_')}`
        );
        dupErr.code = 11000;
        dupErr.statusCode = 409;
        throw dupErr;
      }
    }
  }
}

function wrapDocumentInstance(Model, plainObj) {
  const hydrated = new Model(cloneValue(plainObj));
  hydrated._id = plainObj._id;
  hydrated.isNew = false;

  const plainWithTimestamps = cloneValue(plainObj);

  hydrated.toObject = function toObject() {
    return cloneValue(plainWithTimestamps);
  };
  hydrated.toJSON = function toJSON() {
    return cloneValue(plainWithTimestamps);
  };
  hydrated.save = async function save() {
    const colMap = getCollectionMap(Model.collection.name);
    const now = new Date();
    const updatedPlain = {
      ...plainWithTimestamps,
      ...hydrated._doc,
      _id: plainWithTimestamps._id,
      createdAt: plainWithTimestamps.createdAt || now,
      updatedAt: now,
    };
    enforceUniqueIndexes(Model, updatedPlain, String(updatedPlain._id));
    colMap.set(String(updatedPlain._id), cloneValue(updatedPlain));
    Object.assign(plainWithTimestamps, updatedPlain);
    return hydrated;
  };

  // Copy top-level timestamps onto hydrated instance for direct property access
  hydrated.createdAt = plainWithTimestamps.createdAt;
  hydrated.updatedAt = plainWithTimestamps.updatedAt;
  if (hydrated._doc) {
    hydrated._doc.createdAt = plainWithTimestamps.createdAt;
    hydrated._doc.updatedAt = plainWithTimestamps.updatedAt;
  }

  return hydrated;
}

function buildNewPlainDoc(Model, rawInput) {
  const instance = new Model(rawInput);
  const err = instance.validateSync();
  if (err) {
    err.statusCode = 400;
    throw err;
  }
  const now = new Date();
  const obj = instance.toObject({ virtuals: false });
  obj._id = obj._id || new mongoose.Types.ObjectId();
  obj.createdAt = rawInput?.createdAt ? new Date(rawInput.createdAt) : now;
  obj.updatedAt = rawInput?.updatedAt ? new Date(rawInput.updatedAt) : now;
  return obj;
}

function applyUpdateOperators(targetDoc, update = {}, isInsert = false) {
  const next = cloneValue(targetDoc);
  const hasOperators = Object.keys(update).some((k) => k.startsWith('$'));

  if (!hasOperators) {
    for (const [k, v] of Object.entries(update)) {
      if (k !== '_id') next[k] = cloneValue(v);
    }
  } else {
    if (update.$set && typeof update.$set === 'object') {
      for (const [k, v] of Object.entries(update.$set)) {
        next[k] = cloneValue(v);
      }
    }
    if (update.$inc && typeof update.$inc === 'object') {
      for (const [k, delta] of Object.entries(update.$inc)) {
        next[k] = (Number(next[k]) || 0) + Number(delta);
      }
    }
    if (isInsert && update.$setOnInsert && typeof update.$setOnInsert === 'object') {
      for (const [k, v] of Object.entries(update.$setOnInsert)) {
        if (next[k] === undefined) {
          next[k] = cloneValue(v);
        }
      }
    }
  }

  next.updatedAt = new Date();
  return next;
}

class InMemoryQuery {
  constructor(Model, filter = {}, isSingle = false) {
    this.Model = Model;
    this.filter = filter;
    this.isSingle = isSingle;
    this._sortSpec = null;
    this._skipCount = 0;
    this._limitCount = null;
    this._isLean = false;
  }

  sort(sortSpec) {
    this._sortSpec = sortSpec;
    return this;
  }

  skip(n) {
    this._skipCount = Math.max(0, Number(n) || 0);
    return this;
  }

  limit(n) {
    this._limitCount = Math.max(0, Number(n) || 0);
    return this;
  }

  select() {
    return this;
  }

  session() {
    return this;
  }

  lean() {
    this._isLean = true;
    return this;
  }

  async exec() {
    const colMap = getCollectionMap(this.Model.collection.name);
    let results = [];
    for (const doc of colMap.values()) {
      if (matchesFilter(doc, this.filter)) {
        results.push(cloneValue(doc));
      }
    }

    if (this._sortSpec && typeof this._sortSpec === 'object') {
      const sortEntries = Object.entries(this._sortSpec);
      results.sort((a, b) => {
        for (const [field, dir] of sortEntries) {
          const factor = dir === -1 || dir === 'desc' ? -1 : 1;
          const va = getNestedValue(a, field);
          const vb = getNestedValue(b, field);
          const na = va instanceof Date ? va.getTime() : va;
          const nb = vb instanceof Date ? vb.getTime() : vb;
          if (na < nb) return -1 * factor;
          if (na > nb) return 1 * factor;
        }
        return 0;
      });
    }

    if (this._skipCount > 0) {
      results = results.slice(this._skipCount);
    }

    if (this._limitCount !== null) {
      results = results.slice(0, this._limitCount);
    }

    if (this.isSingle) {
      const first = results[0] || null;
      if (!first) return null;
      return this._isLean ? first : wrapDocumentInstance(this.Model, first);
    }

    return this._isLean
      ? results
      : results.map((r) => wrapDocumentInstance(this.Model, r));
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

export function patchModelForInMemory(Model) {
  if (!Model || patchedModels.has(Model.modelName)) return Model;
  patchedModels.add(Model.modelName);

  const colName = Model.collection.name;

  Model.create = async function create(docOrDocs) {
    const isArray = Array.isArray(docOrDocs);
    const items = isArray ? docOrDocs : [docOrDocs];
    const colMap = getCollectionMap(colName);
    const created = [];

    for (const item of items) {
      const plain = buildNewPlainDoc(Model, item);
      enforceUniqueIndexes(Model, plain);
      colMap.set(String(plain._id), cloneValue(plain));
      created.push(wrapDocumentInstance(Model, plain));
    }

    return isArray ? created : created[0];
  };

  Model.insertMany = async function insertMany(docs = []) {
    const created = await Model.create(docs);
    return Array.isArray(created) ? created : [created];
  };

  Model.find = function find(filter = {}) {
    return new InMemoryQuery(Model, filter, false);
  };

  Model.findOne = function findOne(filter = {}) {
    return new InMemoryQuery(Model, filter, true);
  };

  Model.findById = function findById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return new InMemoryQuery(Model, { _id: '__invalid__' }, true);
    }
    return new InMemoryQuery(
      Model,
      { _id: new mongoose.Types.ObjectId(String(id)) },
      true
    );
  };

  Model.countDocuments = async function countDocuments(filter = {}) {
    const colMap = getCollectionMap(colName);
    let count = 0;
    for (const doc of colMap.values()) {
      if (matchesFilter(doc, filter)) count += 1;
    }
    return count;
  };

  Model.findOneAndUpdate = function findOneAndUpdate(filter = {}, update = {}, options = {}) {
    const queryLike = {
      _isLean: false,
      session() {
        return this;
      },
      lean() {
        this._isLean = true;
        return this;
      },
      async exec() {
        const colMap = getCollectionMap(colName);
        let target = null;
        for (const doc of colMap.values()) {
          if (matchesFilter(doc, filter)) {
            target = cloneValue(doc);
            break;
          }
        }

        if (!target) {
          if (!options.upsert) return null;
          const baseDoc = {};
          for (const [k, v] of Object.entries(filter)) {
            if (!k.startsWith('$') && (typeof v !== 'object' || v instanceof mongoose.Types.ObjectId || v instanceof Date)) {
              baseDoc[k] = cloneValue(v);
            }
          }
          const updatedNew = applyUpdateOperators(baseDoc, update, true);
          const validatedPlain = buildNewPlainDoc(Model, updatedNew);
          enforceUniqueIndexes(Model, validatedPlain);
          colMap.set(String(validatedPlain._id), cloneValue(validatedPlain));
          return this._isLean
            ? cloneValue(validatedPlain)
            : wrapDocumentInstance(Model, validatedPlain);
        }

        const beforeUpdate = cloneValue(target);
        const updatedPlain = applyUpdateOperators(target, update, false);
        enforceUniqueIndexes(Model, updatedPlain, String(updatedPlain._id));
        colMap.set(String(updatedPlain._id), cloneValue(updatedPlain));

        const resultDoc = options.new !== false ? updatedPlain : beforeUpdate;
        return this._isLean
          ? cloneValue(resultDoc)
          : wrapDocumentInstance(Model, resultDoc);
      },
      then(resolve, reject) {
        return this.exec().then(resolve, reject);
      },
    };
    return queryLike;
  };

  Model.findByIdAndUpdate = function findByIdAndUpdate(id, update = {}, options = {}) {
    return Model.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(String(id)) },
      update,
      options
    );
  };

  Model.findOneAndDelete = function findOneAndDelete(filter = {}) {
    const queryLike = {
      _isLean: false,
      session() {
        return this;
      },
      lean() {
        this._isLean = true;
        return this;
      },
      async exec() {
        const colMap = getCollectionMap(colName);
        for (const [idStr, doc] of colMap.entries()) {
          if (matchesFilter(doc, filter)) {
            colMap.delete(idStr);
            return this._isLean
              ? cloneValue(doc)
              : wrapDocumentInstance(Model, doc);
          }
        }
        return null;
      },
      then(resolve, reject) {
        return this.exec().then(resolve, reject);
      },
    };
    return queryLike;
  };

  Model.deleteOne = async function deleteOne(filter = {}) {
    const colMap = getCollectionMap(colName);
    for (const [idStr, doc] of colMap.entries()) {
      if (matchesFilter(doc, filter)) {
        colMap.delete(idStr);
        return { acknowledged: true, deletedCount: 1 };
      }
    }
    return { acknowledged: true, deletedCount: 0 };
  };

  Model.deleteMany = async function deleteMany(filter = {}) {
    const colMap = getCollectionMap(colName);
    let deletedCount = 0;
    for (const [idStr, doc] of colMap.entries()) {
      if (matchesFilter(doc, filter)) {
        colMap.delete(idStr);
        deletedCount += 1;
      }
    }
    return { acknowledged: true, deletedCount };
  };

  return Model;
}

function takeMemoryStoreSnapshot() {
  const snap = new Map();
  for (const [colName, colMap] of memoryStore.entries()) {
    const copyMap = new Map();
    for (const [idStr, doc] of colMap.entries()) {
      copyMap.set(idStr, cloneValue(doc));
    }
    snap.set(colName, copyMap);
  }
  return snap;
}

function restoreMemoryStoreSnapshot(snap) {
  memoryStore.clear();
  for (const [colName, colMap] of snap.entries()) {
    const copyMap = new Map();
    for (const [idStr, doc] of colMap.entries()) {
      copyMap.set(idStr, cloneValue(doc));
    }
    memoryStore.set(colName, copyMap);
  }
}

export function enableInMemoryMongooseEngine() {
  isInMemoryMode = true;
  isConnected = true;

  for (const modelName of mongoose.modelNames()) {
    patchModelForInMemory(mongoose.model(modelName));
  }

  const origModelFn = mongoose.model.bind(mongoose);
  mongoose.model = function patchedMongooseModel(name, schema, collection, options) {
    const m = origModelFn(name, schema, collection, options);
    if (isInMemoryMode) {
      patchModelForInMemory(m);
    }
    return m;
  };

  mongoose.startSession = async function startInMemorySession() {
    let snapshot = null;
    let inTx = false;
    return {
      startTransaction() {
        snapshot = takeMemoryStoreSnapshot();
        inTx = true;
      },
      async commitTransaction() {
        snapshot = null;
        inTx = false;
      },
      async abortTransaction() {
        if (inTx && snapshot) {
          restoreMemoryStoreSnapshot(snapshot);
        }
        snapshot = null;
        inTx = false;
      },
      endSession() {
        snapshot = null;
        inTx = false;
      },
      async withTransaction(fn) {
        this.startTransaction();
        try {
          const res = await fn(this);
          await this.commitTransaction();
          return res;
        } catch (err) {
          await this.abortTransaction();
          throw err;
        }
      },
    };
  };
}

export function clearInMemoryDatabase() {
  memoryStore.clear();
}

function registerDbShutdownHooks() {
  if (dbShutdownHooksRegistered) return;
  dbShutdownHooksRegistered = true;

  const closeGracefully = async () => {
    try {
      if (!isInMemoryMode && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      isConnected = false;
    } catch {
      // Ignore shutdown close errors
    }
  };

  process.once('SIGINT', closeGracefully);
  process.once('SIGTERM', closeGracefully);
}

function isLocalhostMongoUri(uri = '') {
  return /^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/i.test(String(uri).trim());
}

/**
 * Returns non-secret database health metadata for `/api/v1/health`.
 */
export function getDatabaseHealth() {
  if (isInMemoryMode && isConnected) {
    return {
      database: 'connected',
      dbName: activeDbName,
      mode: 'in-memory',
    };
  }

  const ready = mongoose.connection.readyState === 1;
  return {
    database: ready ? 'connected' : 'disconnected',
    dbName: mongoose.connection.name || activeDbName || DEFAULT_DB_NAME,
  };
}

/**
 * Connects Mongoose to MongoDB (`smart_tools_db`) with Atlas-hardened timeouts and pooling.
 * Never falls back to in-memory mode in `production` or when `options.allowInMemoryFallback === false`.
 *
 * @param {string} [uri]
 * @param {{ allowInMemoryFallback?: boolean }} [options]
 */
export async function connectDatabase(uri, options = {}) {
  registerDbShutdownHooks();

  if (isConnected) {
    return { isConnected, isInMemoryMode, dbName: activeDbName };
  }

  const mongoUri =
    uri || process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/${DEFAULT_DB_NAME}`;

  const isProd = process.env.NODE_ENV === 'production';
  const allowFallback =
    !isProd && options.allowInMemoryFallback !== false;

  // Use fast 2.5s timeout only for offline localhost in test/dev; full 10s for Atlas / production
  const selectionTimeoutMs =
    !isProd && isLocalhostMongoUri(mongoUri) && options.allowInMemoryFallback !== false
      ? 2500
      : 10000;

  try {
    await mongoose.connect(mongoUri, {
      dbName: DEFAULT_DB_NAME,
      serverSelectionTimeoutMS: selectionTimeoutMs,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    isConnected = true;
    isInMemoryMode = false;
    activeDbName = mongoose.connection.name || DEFAULT_DB_NAME;
    return { isConnected, isInMemoryMode, dbName: activeDbName };
  } catch (err) {
    if (!allowFallback) {
      throw err;
    }
    if (process.env.NODE_ENV !== 'test') {
      const redactedMsg = String(err?.message || 'MongoDB unreachable').replace(
        /\/\/[^/\s@]+@/g,
        '//<redacted>@'
      );
      console.warn(
        `[SmartTools DB Warning] Could not reach MongoDB (${redactedMsg}). Falling back to volatile in-memory DB (accounts/documents will reset on restart). Check MONGODB_URI and Atlas IP Network Access allowlist.`
      );
    }
    enableInMemoryMongooseEngine();
    activeDbName = DEFAULT_DB_NAME;
    return { isConnected: true, isInMemoryMode: true, dbName: activeDbName };
  }
}

export async function disconnectDatabase() {
  if (!isInMemoryMode && mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  isConnected = false;
}
