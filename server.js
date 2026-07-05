require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

const authRouter = require('./routes/auth');
const batcomputerRouter = require('./routes/batcomputer');
const sessionGuard = require('./middlewares/sessionGuard');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  name: 'bat_identity',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: 'database.db', dir: '.' }),
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 1800000,
  },
}));

app.use(sessionGuard);

app.use('/auth', authRouter);
app.use('/bat-computer', batcomputerRouter);

app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/bat-computer');
  }
  res.redirect('/auth/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur sur http://localhost:${PORT}`));
