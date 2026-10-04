require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ Servidor POSWALVI 2.1 ejecutándose en puerto ${PORT}`);
});