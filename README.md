# POSWALVI Audit

POSWALVI Audit es un módulo de auditoría continua desarrollado para detectar irregularidades operativas dentro de un sistema POS orientado a ventas, inventario, compras y proveedores.

El proyecto forma parte de una propuesta académica de Ingeniería en Sistemas, enfocada en aplicar tecnologías open source para fortalecer el control interno, la trazabilidad y la revisión de operaciones críticas en una PYME.

---

## Objetivo del proyecto

Implementar un módulo de auditoría continua dentro de POSWALVI para detectar irregularidades operativas en ventas, inventario, compras y proveedores en un plazo máximo de 24 horas.

---

## Tecnologías utilizadas

### Backend

- Node.js
- Express.js
- MySQL
- JWT
- bcryptjs
- dotenv
- morgan
- cors
- nodemon

### Base de datos

- MySQL
- MySQL Workbench

### Frontend

Actualmente el frontend está separado en la carpeta `frontend/`, pero se encuentra en fase inicial.

---

## Estructura del proyecto

```text
Poswalvi-Audit/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   └── services/
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example
│
├── database/
│   ├── 05_seed_reglas_auditoria.sql
│   ├── 06_reset_datos_prueba_auditoria.sql
│   ├── 07_datos_prueba_auditoria.sql
│   └── README.md
│
├── frontend/
│   └── src/
│       ├── pages/
│       └── services/
│
├── docs/
├── .gitignore
└── README.md