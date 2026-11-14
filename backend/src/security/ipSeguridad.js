const { isIP } = require('node:net');
const { URL } = require('node:url');

function normalizarIp(valor) {
  if (typeof valor !== 'string' || valor.includes('%') || !isIP(valor)) return null;
  if (isIP(valor) === 4) return valor;
  const canonica = new URL(`http://[${valor}]/`).hostname.slice(1, -1).toLowerCase();
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(canonica);
  if (mapped) {
    const alto = parseInt(mapped[1], 16), bajo = parseInt(mapped[2], 16);
    return [alto >> 8, alto & 255, bajo >> 8, bajo & 255].join('.');
  }
  // ::1 y 127.0.0.1 son direcciones distintas, no una concesion mutua de confianza.
  return canonica;
}

function obtenerIp(req) {
  // req.ip depende exclusivamente de la configuracion trust proxy de Express.
  // No se interpreta X-Forwarded-For directamente ni se habilita trust proxy.
  return normalizarIp(req.ip) || normalizarIp(req.socket?.remoteAddress);
}
module.exports = {normalizarIp, obtenerIp};
