const Database = require('better-sqlite3');

const db = new Database('database.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role     TEXT NOT NULL DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS reports (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS connexions_audit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL,
    action     TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT UNIQUE NOT NULL,
    user_id    INTEGER NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS oauth_identities (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    provider         TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email            TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all();
const userColumnNames = userColumns.map((col) => col.name);

if (!userColumnNames.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}
if (!userColumnNames.includes('two_factor_secret')) {
  db.exec('ALTER TABLE users ADD COLUMN two_factor_secret TEXT');
}
if (!userColumnNames.includes('two_factor_enabled')) {
  db.exec('ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0');
}

const passwordColumn = userColumns.find((col) => col.name === 'password');
const needsUsersRebuild = passwordColumn?.notnull === 1;

// SQLite's `ALTER TABLE ... RENAME TO` silently rewrites the FOREIGN KEY clauses of every
// OTHER table pointing at the renamed table. A first version of this migration renamed
// `users` to `users_old`, rebuilt `users`, then dropped `users_old` — which left `reports`,
// `refresh_tokens` and `oauth_identities` referencing a table that no longer exists (their
// FK text had been auto-rewritten to "REFERENCES users_old(id)"). SQLite still resolves that
// reference at prepare() time for some statements (e.g. UPSERT), so it surfaced as a runtime
// "no such table: main.users_old" error instead of failing loudly at migration time.
const staleReference = (tableName) => {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return row?.sql?.includes('users_old') ?? false;
};
const needsDependentsRebuild = ['reports', 'refresh_tokens', 'oauth_identities'].some(staleReference);

if (needsUsersRebuild || needsDependentsRebuild) {
  const rebuildTable = (name, createSql, columns) => {
    db.exec(`ALTER TABLE ${name} RENAME TO ${name}_old_tmp`);
    db.exec(createSql);
    db.exec(`INSERT INTO ${name} (${columns}) SELECT ${columns} FROM ${name}_old_tmp`);
    db.exec(`DROP TABLE ${name}_old_tmp`);
  };

  db.exec('BEGIN TRANSACTION');

  if (needsUsersRebuild) {
    rebuildTable(
      'users',
      `CREATE TABLE users (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        username           TEXT UNIQUE NOT NULL,
        password           TEXT,
        email              TEXT,
        role               TEXT NOT NULL DEFAULT 'user',
        two_factor_secret  TEXT,
        two_factor_enabled INTEGER NOT NULL DEFAULT 0
      )`,
      'id, username, password, role, two_factor_secret, two_factor_enabled'
    );
  }

  // Every table with a FOREIGN KEY on users(id) must be rebuilt too, so its FK clause is
  // freshly written against the current `users` table instead of a stale renamed copy.
  rebuildTable(
    'reports',
    `CREATE TABLE reports (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    'id, user_id, content'
  );

  rebuildTable(
    'refresh_tokens',
    `CREATE TABLE refresh_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      token      TEXT UNIQUE NOT NULL,
      user_id    INTEGER NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    'id, token, user_id, used, expires_at, created_at'
  );

  rebuildTable(
    'oauth_identities',
    `CREATE TABLE oauth_identities (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL,
      provider         TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email            TEXT,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, provider_user_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    'id, user_id, provider, provider_user_id, email, created_at'
  );

  db.exec('COMMIT');
} else if (!userColumnNames.includes('email')) {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT');
}

module.exports = db;
