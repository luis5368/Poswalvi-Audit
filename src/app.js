const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const auditoriaRoutes = require('./routes/auditoriaRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    mensaje: 'API POSWALVI 2.1 funcionando correctamente'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/auditoria', auditoriaRoutes);

module.exports = app;  