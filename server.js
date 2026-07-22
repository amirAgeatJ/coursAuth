require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRouter = require('./routes/auth');
const apiAuthRouter = require('./routes/apiAuth');
const apiUserRouter = require('./routes/apiUser');
const batcomputerRouter = require('./routes/batcomputer');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

app.use('/auth', authRouter);
app.use('/api/auth', apiAuthRouter);
app.use('/api/user', apiUserRouter);
app.use('/bat-computer', batcomputerRouter);

app.get('/', (req, res) => {
  res.redirect('/bat-computer');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur sur http://localhost:${PORT}`));
