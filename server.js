const express = require('express');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database('database.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reports (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

app.use(express.json());
app.use(express.static('public'));

function basicAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Bat-Ordinateur"');
    return res.status(401).json({ error: 'Authentification requise' });
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [username, password] = decoded.split(':');

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.set('WWW-Authenticate', 'Basic realm="Bat-Ordinateur"');
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  req.user = user;
  next();
}


app.post('/register', async (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username et password requis' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères min)' });
  }
  if (username.includes(' ')) {
    return res.status(400).json({ error: "Le username ne doit pas contenir d'espaces" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
    res.status(201).json({ message: 'Utilisateur créé' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ce username est déjà pris' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/bat-computer', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'bat-computer.html'));
});

app.get('/api/secrets', basicAuth, (req, res) => {
  res.json([
    { name: 'Batarang', desc: 'Arme de jet',             icon: 'fa-shuriken'     },
    { name: 'Grappin',  desc: 'Ascension des bâtiments', icon: 'fa-anchor'       },
    { name: 'Fumigène', desc: 'Écran de fumée tactique', icon: 'fa-smog'         },
    { name: 'Traceur',  desc: 'Suivi de cibles',         icon: 'fa-location-dot' },
  ]);
});

app.get('/api/me', basicAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

app.post('/api/reports', basicAuth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Contenu requis' });

  db.prepare('INSERT INTO reports (user_id, content) VALUES (?, ?)').run(req.user.id, content);
  res.status(201).json({ message: 'Rapport enregistré' });
});

app.listen(3000, () => console.log('Serveur sur http://localhost:3000'));
