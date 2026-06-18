afterAll(async () => {
  const db = require('../src/db/pool');
  await db.close();
});
