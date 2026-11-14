const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const permiso = require('../middlewares/permisoMiddleware');
const c = require('../controllers/alertasSeguridadController');
router.use(auth);
router.get('/',permiso('AlertasSeguridad','Consultar'),c.listar);
router.get('/:id',permiso('AlertasSeguridad','Consultar'),c.detalle);
router.patch('/:id/leida',permiso('AlertasSeguridad','Consultar'),permiso('AlertasSeguridad','Reconocer'),c.reconocer);
module.exports = router;
