const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');

const {
  login,
  logout,
  perfil
} = require('../controllers/authcontroller');

router.post('/login', login);
router.get('/perfil', verificarToken, perfil);
router.post('/logout', verificarToken, logout);

module.exports = router;