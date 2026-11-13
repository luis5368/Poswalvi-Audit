export function formatDuracion(ms) {
  if (ms == null || !Number.isFinite(Number(ms)) || Number(ms) < 0) return 'No disponible';
  const n = Number(ms);
  if (n < 1000) return `${n.toFixed(1)} ms`;
  if (n < 60000) return `${(n / 1000).toFixed(2)} s`;
  return `${(n / 60000).toFixed(2)} min`;
}

export function formatHoras(horas) {
  if (horas == null || !Number.isFinite(Number(horas)) || Number(horas) < 0) return 'No disponible';
  const n = Number(horas);
  return n > 0 && n < 0.01 ? '< 0.01 h' : `${n.toFixed(2)} h`;
}
