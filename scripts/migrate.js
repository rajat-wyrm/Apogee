require('dotenv').config();
const { run } = require('../src/db/migrate');
run().catch((e) => { console.error(e); process.exit(1); });
