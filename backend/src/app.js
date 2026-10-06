const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const auditoriaRoutes = require('./routes/auditoriaRoutes');
const authRoutes = require('./routes/authRoutes');
const sucursalesRoutes = require('./routes/sucursalesRoutes');
const cajasRoutes = require('./routes/cajasRoutes');
const turnosCajaRoutes = require('./routes/turnosCajaRoutes');
const ventasRoutes = require('./routes/ventasRoutes');

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
app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/cajas', cajasRoutes);
app.use('/api/turnos-caja', turnosCajaRoutes);
app.use('/api/ventas', ventasRoutes);
module.exports = app;  