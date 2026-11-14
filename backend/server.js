require('dotenv').config();
const app = require('./src/app');
const eventosSeguridad = require('./src/services/eventosSeguridadService');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  eventosSeguridad.iniciar();
  console.log(`✅ Servidor POSWALVI 2.1 ejecutándose en puerto ${PORT}`);
});