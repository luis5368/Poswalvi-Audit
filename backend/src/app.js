const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const auditoriaRoutes = require('./routes/auditoriaRoutes');
const authRoutes = require('./routes/authRoutes');
const sucursalesRoutes = require('./routes/sucursalesRoutes');
const cajasRoutes = require('./routes/cajasRoutes');
const turnosCajaRoutes = require('./routes/turnosCajaRoutes');
const ventasRoutes = require('./routes/ventasRoutes');
const metodosPagoRoutes = require('./routes/metodosPagoRoutes');
const inventarioSaldosRoutes = require('./routes/inventarioSaldosRoutes');
const productosRoutes = require('./routes/productosRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const proveedoresRoutes = require('./routes/proveedoresRoutes');
const productoProveedorRoutes = require('./routes/productoProveedorRoutes');
const comprasRoutes = require('./routes/comprasRoutes');
const dashboardAdminRoutes = require('./routes/dashboardAdminRoutes');

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
app.use('/api/metodos-pago', metodosPagoRoutes);
app.use('/api/inventario-saldos', inventarioSaldosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/producto-proveedor', productoProveedorRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/dashboard-admin', dashboardAdminRoutes);

module.exports = app;  