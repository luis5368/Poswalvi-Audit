# Validacion de publicacion JWT y Centro de Alertas

## Alcance y base

Rama: feature/pg2-jwt-alertas-publicable. Commit inicial preservado: 9d37a4156cd62dc2abb3893f456c89c35c2192df. Base origin/main verificada: 2a23556978de9a3d75d9612318df6caaebe131e2. Estado inicial limpio y exactamente 21 archivos de integracion. No se repitio el cherry-pick.

Trabajo limitado a la carpeta publicable. No se modificaron el original, otros worktrees ni MySQL. Sin migraciones, datos sinteticos copiados, cambios de roles, despliegue o cambios directos en main.

## Dependencias

frontend/package.json contenia nueve etiquetas invalidas ^latest. Se fijaron versiones numericas ya presentes en el lockfile: plugin-react 6.1.2, Vite 8.3.3, React/react-dom 19.3.0, axios 1.20.0, lucide-react 1.52.0, react-router-dom 7.18.4, sweetalert2 11.26.25. ESLint paso de 10.12.0 resuelto a 10.15.0 por vulnerabilidad. Lockfile regenerado; nombre de paquete raiz sincronizado.

Metadatos npm: plugin-react 6.1.2 admite Vite ^8.0.0. Vite/plugin requieren Node ^20.19.0 o >=22.12.0. Validado con Node 24.20.0 y npm 11.19.0.

| Paquete | Antes -> despues | Tipo / exposicion | Severidad inicial | Tratamiento |
|---|---|---|---|---|
| body-parser | 2.3.0 -> 2.4.0 | Transitiva Express, produccion | Alta | Actualizacion compatible dentro del rango |
| proxy-addr | 2.0.7 -> 2.0.8 | Transitiva Express, produccion | Critica | Parche; no se habilito trust proxy |
| qs | 6.16.0 -> 6.17.1 | Transitiva, produccion | Moderada | Actualizacion compatible |
| nodemon | 3.1.14 -> 3.1.11 | Directa, desarrollo | Moderada por minimatch | Fijacion de version anterior de la misma major con cadena corregida |
| minimatch backend | 10.2.6 -> 3.1.5 | Transitiva nodemon, desarrollo | Moderada | Dependencia soportada por nodemon 3.1.11; sin override forzado |
| brace-expansion backend | 5.0.9 -> 1.1.22 | Transitiva, desarrollo | Alta | Cadena de nodemon 3.1.11 |
| follow-redirects | 1.16.1 -> 1.16.3 | Transitiva axios; relevante para adaptador Node | Alta | Parche; la app web usa adaptador de navegador |
| eslint | 10.12.0 -> 10.15.0 | Directa, desarrollo | Moderada | Actualizacion de la misma major |
| @eslint/config-array | 0.23.5 -> 0.23.6 | Transitiva, desarrollo | Moderada | Cadena de ESLint actualizada |
| minimatch frontend | 10.2.6 -> 11.0.8 | Transitiva, desarrollo | Moderada | Actualizacion requerida y soportada por ESLint, sin override |

Auditoria inicial backend: 6 vulnerabilidades (3 moderadas, 2 altas, 1 critica); omit=dev: 3 (1 por severidad). Frontend inicialmente no auditable por EINVALIDTAGNAME; tras corregir etiquetas: 4 (3 moderadas, 1 alta).

Auditorias finales ejecutadas: npm audit --prefix backend --omit=dev, npm audit --prefix backend y npm audit --prefix frontend: 0 vulnerabilidades en las tres. No se utilizo audit fix --force. El resultado refleja la base de avisos de npm al ejecutar, no garantiza ausencia de futuras vulnerabilidades.

La bajada de nodemon afecta la herramienta de desarrollo, no Express ni el runtime de produccion. Queda pendiente comprobar manualmente file watching en los sistemas de desarrollo. Los cambios transitivos de herramientas siguen los rangos de sus mantenedores.

## Pruebas ejecutadas

- JWT/eventos/alertas: 117/117, exit 0.
- ventas-autorizacion: 56/56, exit 0.
- cierre funcional: 53/53, exit 0.
- ventas-integridad + correcciones + permisos: 65/65, exit 0.
- Total: 291/291; ninguna fallida, omitida o cancelada.
- No existe script npm test general; se ejecutaron los ocho archivos test versionados, con repositorios simulados. No se conectaron bases reales.
- La caracterizacion de polling ya usa permisos-antes.fixture.txt en la base origin/main. Aqui no se cambiaron su codigo ni expectativas; la caracterizacion y el comportamiento corregido pasan.
- npm ci frontend y backend completados. Backend se instalo con --ignore-scripts. Build Vite final satisfactorio, 2014 modulos.
- Un intento de build dentro del sandbox fallo con EPERM al limpiar dist. Repetido fuera del sandbox, exit 0; no requirio cambio de codigo.
- Advertencias existentes: configuracion Vite ESM cargada como CommonJS, bundle >500 kB y promesas de VM en fixtures Express. No impiden esta compilacion.
- node --check de los archivos productivos backend cambiados y git diff --check satisfactorios. No se afirmaron pruebas de navegador o MySQL real.

## Integridad y permisos

Se conservaron el motor recuperable, expiracion transaccional de sesiones, normalizacion IP, API de alertas y reconocimiento con auditoria. React mantiene el menu completo y rutas protegidas. La API exige AlertasSeguridad:Consultar para GET y Consultar + Reconocer para PATCH; ocultar el boton no es el control de seguridad.

Politica esperada para provisionamiento autorizado: Administrador y Superusuario Consultar/Reconocer; Auditor Consultar; otros sin acceso salvo concesion expresa. El codigo resuelve permisos efectivos, no nombres de roles. Esta entrega no consulta ni asigna permisos reales: su provisionamiento y revision de miembros sigue siendo requisito de produccion.

Revision previa: 21 archivos del commit saliente, sin .env, respaldos SQL, claves privadas, JWT literales ni tokens de proveedor detectados. Las credenciales de fixtures son sinteticas; el codigo usa variables de entorno. Lockfiles sin URL con credenciales. El escaneo es una comprobacion complementaria, no una certificacion exhaustiva de secretos.

## Segundo commit: seleccion exacta

- backend/package.json
- backend/package-lock.json
- frontend/package.json
- frontend/package-lock.json
- docs/pg2/publicacion/VALIDACION_JWT_ALERTAS.md

No se modifico codigo funcional ni pruebas. Solo estas cinco rutas se preparan explicitamente. El commit inicial permanece intacto. No se incluyen node_modules, dist, configuraciones privadas ni evidencias locales de otros entornos.

## Dictamen y pendientes

APTO para publicar la rama y revision mediante Pull Request, condicionado a verificar nuevamente el remoto antes del push. No constituye autorizacion de despliegue ni de merge a main. Produccion requiere configuracion de secretos, permisos efectivos aprobados y ensayo aislado de locks, transacciones y recuperacion MySQL; no se sustituye esa validacion por mocks.

La publicacion y URL final del PR se informan al finalizar la operacion. No se reescribe historial ni se utiliza force push.
