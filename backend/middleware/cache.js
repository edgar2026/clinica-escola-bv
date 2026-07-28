const CACHE_TTL = 60000;
const STATIC_TTL = 300000;
const MAX_CACHE_SIZE = 200;

const apiCache = new Map();

function getCacheKey(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return `${req.method}:${url.pathname}:${url.searchParams.toString()}`;
}

function isCacheableEndpoint(pathname) {
  const cacheablePrefixes = [
    '/api/admin/opcoes-cadastro',
    '/api/admin/cursos',
    '/api/admin/periodos',
    '/api/admin/turnos',
    '/api/admin/setores',
    '/api/admin/especialidades',
    '/api/admin/usuarios',
    '/api/horarios',
    '/api/alunos',
  ];
  return cacheablePrefixes.some(p => pathname.startsWith(p));
}

function isCacheableMethod(method) {
  return method === 'GET' || method === 'HEAD';
}

function getCached(key) {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) {
    apiCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttl) {
  apiCache.set(key, { data, ts: Date.now(), ttl });
  if (apiCache.size > MAX_CACHE_SIZE) {
    const oldest = apiCache.keys().next().value;
    apiCache.delete(oldest);
  }
}

function invalidateCache(pattern) {
  for (const key of apiCache.keys()) {
    if (key.includes(pattern)) {
      apiCache.delete(key);
    }
  }
}

function invalidateAll() {
  apiCache.clear();
}

function cacheMiddleware(opts = {}) {
  const ttl = opts.ttl || CACHE_TTL;
  const staticCache = opts.static || false;

  return (req, res, next) => {
    if (!isCacheableMethod(req.method)) {
      return next();
    }

    if (staticCache && !isCacheableEndpoint(req.path)) {
      return next();
    }

    const key = getCacheKey(req);
    const cached = getCached(key);

    if (cached !== null) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    res.setHeader('X-Cache', 'MISS');

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const ttlToUse = staticCache ? STATIC_TTL : ttl;
      setCache(key, body, ttlToUse);
      res.setHeader('X-Cache', 'STORED');
      return originalJson(body);
    };

    next();
  };
}

function cacheInvalidationMiddleware(req, res, next) {
  const method = req.method.toUpperCase();

  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const cacheablePrefixes = [
      '/api/admin',
      '/api/horarios',
      '/api/alunos',
      '/api/agendamentos',
      '/api/pontos',
      '/api/gerencia',
    ];

    for (const prefix of cacheablePrefixes) {
      if (req.path.startsWith(prefix)) {
        invalidateCache(prefix);
        break;
      }
    }
  }

  next();
}

module.exports = {
  cacheMiddleware,
  cacheInvalidationMiddleware,
  invalidateCache,
  invalidateAll,
};