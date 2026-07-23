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
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((col) => col.name);

if (!userColumns.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}
if (!userColumns.includes('two_factor_secret')) {
  db.exec('ALTER TABLE users ADD COLUMN two_factor_secret TEXT');
}
if (!userColumns.includes('two_factor_enabled')) {
  db.exec('ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0');
}

module.exports = db;
