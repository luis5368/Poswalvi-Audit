# Base de datos - POSWALVI Audit

Esta carpeta contiene los scripts SQL utilizados para configurar, documentar y validar el módulo de auditoría continua de POSWALVI.

El objetivo de estos scripts es permitir reconstruir las reglas de auditoría y los datos de prueba utilizados durante la validación técnica del proyecto.

---

## Orden recomendado de ejecución

Para preparar una demostración limpia del motor de auditoría continua, ejecutar los scripts en el siguiente orden:

```sql
05_seed_reglas_auditoria.sql
06_reset_datos_prueba_auditoria.sql
07_datos_prueba_auditoria.sql