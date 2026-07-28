const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 30000,
  rejectUnauthorized: true
});

function formatParam(p) {
  if (p === null || p === undefined) return 'NULL';
  if (typeof p === 'number') return p;
  if (typeof p === 'boolean') return p ? 'TRUE' : 'FALSE';
  const str = String(p).replace(/'/g, "''");
  return `'${str}'`;
}

function executePgQuery(sql, params = []) {
  let paramIndex = 1;
  let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

  let finalQuery = pgSql.replace(/\$(\d+)(?![0-9])/g, (match, num) => {
    const idx = parseInt(num, 10) - 1;
    if (idx >= 0 && idx < params.length) {
      return formatParam(params[idx]);
    }
    return match;
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Erro no Supabase PostgreSQL (${res.statusCode}): ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Falha no parse do Supabase: ${data}`));
        }
      });
    });
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout na query ao Supabase'));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ query: finalQuery }));
    req.end();
  });
}

async function runAsync(sql, params = []) {
  const result = await executePgQuery(sql, params);
  const lastID = Array.isArray(result) && result.length > 0 && result[0].id ? result[0].id : null;
  return {
    lastID,
    changes: Array.isArray(result) ? result.length : 1
  };
}

async function getAsync(sql, params = []) {
  const rows = await executePgQuery(sql, params);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function allAsync(sql, params = []) {
  const rows = await executePgQuery(sql, params);
  return Array.isArray(rows) ? rows : [];
}

async function initDatabase() {
  try {
    const res = await allAsync('SELECT COUNT(*) as total FROM usuarios');
    console.log(`Supabase PostgreSQL ativo. Total de usuarios: ${res && res[0] ? res[0].total : 0}`);
  } catch (err) {
    console.error('Erro ao conectar no Supabase:', err.message);
  }
}

async function criarUsuarioSupabaseAuth(email, senha, nome, perfil = 'aluno', matricula = '') {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: senha || '123456',
      email_confirm: true,
      user_metadata: { nome, perfil, matricula }
    });
    if (error && error.message.includes('already registered')) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users?.find(u => u.email === email);
      if (existing) {
        await supabase.auth.admin.updateUserById(existing.id, {
          password: senha || '123456',
          email_confirm: true,
          user_metadata: { nome, perfil, matricula }
        });
      }
    }
    return data;
  } catch (err) {
    console.error('Erro ao sincronizar com Supabase Auth:', err.message);
  }
}

async function supaSelect(tabela, { colunas = '*', filtros = {}, ordenar = null, limite = null, offset = null } = {}) {
  let query = supabase.from(tabela).select(colunas);
  for (const [col, val] of Object.entries(filtros)) {
    if (Array.isArray(val)) {
      if (val.length === 0) return [];
      query = query.in(col, val);
    } else {
      query = query.eq(col, val);
    }
  }
  if (ordenar) query = query.order(ordenar.coluna, { ascending: ordenar.asc ?? true });
  if (limite) query = query.limit(limite);
  if (offset) query = query.offset(offset);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

async function supaCount(tabela, filtros = {}) {
  let query = supabase.from(tabela).select('*', { count: 'exact', head: true });
  for (const [col, val] of Object.entries(filtros)) {
    if (Array.isArray(val)) {
      if (val.length === 0) return 0;
      query = query.in(col, val);
    } else {
      query = query.eq(col, val);
    }
  }
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count || 0;
}

async function supaInsert(tabela, registro) {
  const { data, error } = await supabase.from(tabela).insert(registro).select();
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function supaUpdate(tabela, registro, condicoes) {
  let query = supabase.from(tabela).update(registro);
  for (const [col, val] of Object.entries(condicoes)) {
    query = query.eq(col, val);
  }
  const { data, error } = await query.select();
  if (error) throw new Error(error.message);
  return data;
}

async function supaDelete(tabela, condicoes) {
  let query = supabase.from(tabela).delete();
  for (const [col, val] of Object.entries(condicoes)) {
    query = query.eq(col, val);
  }
  const { error } = await query;
  if (error) throw new Error(error.message);
}

module.exports = {
  db: supabase,
  supabase,
  initDatabase,
  runAsync,
  getAsync,
  allAsync,
  criarUsuarioSupabaseAuth,
  supaSelect,
  supaCount,
  supaInsert,
  supaUpdate,
  supaDelete
};

