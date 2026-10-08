const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');

const {
  login,
  logout,
  perfil,
  cambiarPassword
} = require('../controllers/authcontroller');

router.post('/login', login);
router.get('/perfil', verificarToken, perfil);
router.post('/logout', verificarToken, logout);
router.patch('/cambiar-password', verificarToken, cambiarPassword);



module.exports = router;