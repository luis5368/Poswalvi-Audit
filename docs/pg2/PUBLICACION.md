# Publicacion PG II

Rama independiente basada en main. Contiene codigo funcional actualizado, correcciones de Ventas, navegacion por permisos, revision de Auditoria, Reportes, Configuracion y correcciones de metricas y conservacion de formularios.

No incluye commits privados, capturas, informes de Docker, baselines, rutas del equipo ni evidencias de sesiones. La base remota existente se conserva. No incorpora la candidata PG1 ni su migracion experimental.

Validacion de esta seleccion: 174/174 pruebas Node con repositorios sinteticos; dependencias locales existentes, sin MySQL. Codigo productivo identico al commit fuente revisado. El fixture anterior del hook permite caracterizacion sin acceder al historial privado. No se instalaron dependencias.

Validacion previa del codigo fuente: Vite satisfactorio; navegador 23/25, con desbordamientos pendientes a 360 y 768 px. No se repitieron build ni navegador en este nuevo worktree. Quedan pendientes MySQL aislado, concurrencia y los limites documentados de proteccion de formularios. No es una autorizacion de despliegue ni de ejecucion de migraciones.

Pruebas: node --test backend/test/ventas-autorizacion.test.js backend/test/ventas-integridad.test.js docs/pg2/cierre_funcional/pruebas/funcional.test.cjs docs/pg2/correcciones/correcciones.test.cjs docs/pg2/correcciones/permisos.test.cjs
