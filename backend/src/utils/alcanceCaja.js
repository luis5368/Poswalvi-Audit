
const pool = require('../config/db');

const obtenerAlcanceCaja = async (req, db = pool) => {
  const idUsuario = Number(req.usuario.id_usuario);

  const [usuarios] = await db.query(
    `
    SELECT
      id_usuario,
      id_sucursal,
      estado
    FROM usuarios
    WHERE id_usuario = ?
    LIMIT 1
    `,
    [idUsuario]
  );

  if (!usuarios.length || usuarios[0].estado !== 'Activo') {
    return null;
  }

  const rol = String(req.usuario.rol || '');

  return {
    idUsuario,
    idSucursal:
      usuarios[0].id_sucursal == null
        ? null
        : Number(usuarios[0].id_sucursal),

    esGlobal: ['Administrador', 'Superusuario'].includes(rol),
    esCajero: rol === 'Cajero'
  };
};

module.exports = obtenerAlcanceCaja;
