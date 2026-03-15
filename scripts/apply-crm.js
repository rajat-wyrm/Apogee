require('dotenv').config();
const fs = require('fs');
const db = require('../src/db/pool');

(async () => {
  const sql = fs.readFileSync('src/db/schema-crm.sql', 'utf8');

  // Extract CREATE TABLE statements by tracking parenthesis depth
  const tableStatements = [];
  const lines = sql.split('\n');
  let inCreateTable = false;
  let currentStmt = '';
  let parenDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('CREATE TABLE')) {
      inCreateTable = true;
      currentStmt = line;
      parenDepth = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    } else if (inCreateTable) {
      currentStmt += '\n' + line;
      parenDepth += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      if (parenDepth <= 0 && trimmed.endsWith(';')) {
        tableStatements.push(currentStmt.trim());
        inCreateTable = false;
        currentStmt = '';
      }
    }
  }

  console.log('Found', tableStatements.length, 'CREATE TABLE statements');
  let ok = 0, fail = 0;

  for (const s of tableStatements) {
    try {
      await db.query(s);
      ok++;
    } catch(e) {
      console.log('FAIL:', e.message.slice(0, 200));
      fail++;
    }
  }
  console.log('Tables: ok=' + ok + ' fail=' + fail);

  // Create indexes
  const idxRegex = /CREATE INDEX IF NOT EXISTS[^;]+;/g;
  const indexStmts = sql.match(idxRegex) || [];
  console.log('Found', indexStmts.length, 'CREATE INDEX statements');
  for (const s of indexStmts) {
    try { await db.query(s); ok++; } catch(e) { /* skip already exists */ }
  }

  // Create function and triggers
  const funcMatch = sql.match(/CREATE OR REPLACE FUNCTION[\s\S]+?\$\$ LANGUAGE plpgsql;/);
  if (funcMatch) {
    try { await db.query(funcMatch[0]); ok++; console.log('Function created'); }
    catch(e) { console.log('Func fail:', e.message.slice(0, 100)); }
  }

  const doMatch = sql.match(/DO \$\$[\s\S]+?\$\$;/);
  if (doMatch) {
    try { await db.query(doMatch[0]); ok++; console.log('Triggers created'); }
    catch(e) { console.log('Triggers fail:', e.message.slice(0, 100)); }
  }

  console.log('Final: ok=' + ok + ' fail=' + fail);

  const r = await db.query(
    "SELECT t.table_name, (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='apogee' AND table_name=t.table_name) as cols FROM information_schema.tables t WHERE table_schema='apogee' AND table_name LIKE 'crm_%' ORDER BY table_name"
  );
  console.log('CRM tables:');
  r.rows.forEach(row => console.log('  ' + row.table_name + ': ' + row.cols + ' columns'));

  await db.close();
})();
