const fs = require('fs');
const path = require('path');
const db = require('./pool');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const ADVANCED_SCHEMA_FILE = path.join(__dirname, 'schema-advanced.sql');

// Split a SQL file into individual statements, respecting $...$ (dollar-quoted) blocks.
const splitSqlStatements = (sql) => {
  const stmts = [];
  let buf = '';
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = null; // active dollar-quote tag (e.g. '$$' or '$tag$')
  while (i < sql.length) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);
    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (next2 === '*/') { buf += '*'; i += 2; inBlockComment = false; continue; }
      i++;
      continue;
    }
    if (dollarTag) {
      buf += ch;
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag.slice(1);
        i += dollarTag.length;
        dollarTag = null;
      } else {
        i++;
      }
      continue;
    }
    if (next2 === '--') { inLineComment = true; buf += ch; i++; continue; }
    if (next2 === '/*') { inBlockComment = true; buf += ch; i++; continue; }
    // Detect start of a dollar-quote: $tag$ where tag is [A-Za-z_][A-Za-z0-9_]*
    if (ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
      if (next2 === '$$') {
        dollarTag = '$$';
        buf += '$$';
        i += 2;
        continue;
      }
    }
    if (ch === ';') {
      buf += ch;
      const cleaned = buf
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
      if (cleaned.length > 0 && cleaned !== ';') stmts.push(cleaned);
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim();
  if (tail.length > 0) stmts.push(tail);
  return stmts;
};

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function applied() {
  const r = await db.query('SELECT name FROM _migrations');
  return new Set(r.rows.map((row) => row.name));
}

async function run() {
  await ensureMigrationsTable();
  const done = await applied();

  await db.ensureSchema();

  // Strip comment lines from each candidate statement before filtering.
  const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const statements = splitSqlStatements(sql);

  const fileName = 'initial_schema';
  if (done.has(fileName)) {
    console.log('[migrate] schema already applied — skipping');
    return { applied: 0, skipped: 1 };
  }

  console.log(`[migrate] applying ${statements.length} statements…`);
  for (const stmt of statements) {
    try {
      await db.query(stmt);
    } catch (err) {
      if (err.code === '42P07' || err.code === '42710' || err.code === '42P06' || err.code === '42701' || /already exists/i.test(err.message)) {
        continue;
      }
      console.error('[migrate] failed statement:', stmt.slice(0, 200));
      throw err;
    }
  }

  // Apply advanced schema (additive)
  if (fs.existsSync(ADVANCED_SCHEMA_FILE)) {
    const advSql = fs.readFileSync(ADVANCED_SCHEMA_FILE, 'utf8');
    const advStatements = splitSqlStatements(advSql);
    console.log(`[migrate] applying ${advStatements.length} advanced statements…`);
    for (const stmt of advStatements) {
      try {
        await db.query(stmt);
      } catch (err) {
        if (err.code === '42P07' || err.code === '42710' || err.code === '42P06' || err.code === '42701' || err.code === '42703' && /already exists/i.test(err.message)) {
          continue;
        }
        // Skip trigger errors on already-existing tables
        if (/already exists/i.test(err.message)) continue;
        console.error('[migrate] adv failed:', stmt.slice(0, 100), '|', err.message);
      }
    }
  }

  await db.query('INSERT INTO _migrations(name) VALUES ($1) ON CONFLICT DO NOTHING', [fileName]);

  console.log('[migrate] done');
  return { applied: 1, skipped: 0 };
}

if (require.main === module) {
  run()
    .then((r) => {
      console.log('[migrate] result', r);
      return db.close();
    })
    .catch((err) => {
      console.error('[migrate] error', err);
      process.exit(1);
    });
}

module.exports = { run };
