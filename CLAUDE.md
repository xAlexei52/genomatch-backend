# CLAUDE.md — Genomatch Backend

Contexto del proyecto para sesiones de desarrollo con IA.

---

## Descripción del proyecto

**Genomatch** es un sistema backend para bancos de sangre que:
- Recibe e importa resultados de secuenciación NGS (panel RBCPv3) de grupos sanguíneos
- Almacena fenotipos y genotipos de donadores
- Busca donadores compatibles con receptores usando similitud vectorial (pgvector)
- Cumple regulación NOM-253-SSA1 (México) / 21 CFR Part 11 con audit trail completo

---

## Stack tecnológico

| Capa              | Tecnología                                   |
|-------------------|----------------------------------------------|
| Runtime           | Node.js                                      |
| Framework         | Express 5.2.1                                |
| ORM (legacy auth) | Sequelize 6.37.7                             |
| DB driver         | pg 8.16.3 (pg.Pool para migraciones e import)|
| Base de datos     | PostgreSQL + **pgvector**                    |
| Auth              | JWT (jsonwebtoken)                           |
| Hash              | bcryptjs                                     |
| Upload            | multer (memory storage)                      |
| Seguridad         | helmet, cors                                 |
| Logging           | morgan                                       |
| Migration runner  | `scripts/db-migrate.js` (custom, usa pg)     |
| Linting      | ESLint + Prettier           |

---

## Estructura de directorios

```
genomatch-backend/
├── config/
│   ├── env.js              ← Variables de entorno (DB, JWT, CORS, port)
│   └── database.js         ← Config Sequelize (dev/test/prod)
├── database/
│   └── migrations/         ← SQL puro (001–013), NO son migraciones Sequelize
│       ├── 001_extensions.sql
│       ├── 002_reference_tables.sql
│       ├── 003_tenant_users.sql
│       ├── 004_permissions.sql
│       ├── 005_samples.sql
│       ├── 006_vector_columns.sql
│       ├── 007_allele_consensus.sql
│       ├── 008_audit_trail.sql
│       ├── 009_indexes.sql
│       ├── 010_materialized_views.sql
│       ├── 011_functions.sql
│       ├── 012_seed_data.sql
│       └── 013_fix_columns.sql   ← ÚLTIMA versión válida del schema
├── example_data/
│   └── RBCPv3-Geno-23/     ← Archivos de ejemplo de una muestra
│       ├── RBCPv3-Geno-23.sampleDetailsLong.tsv   ← Fuente principal
│       ├── alleles/         ← 28 TSVs por sistema ISBT
│       └── consensus/       ← 26 CSVs por gen
├── src/
│   ├── app.js               ← Express app (middlewares globales, rutas)
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   └── import.controller.js   ← [NUEVO]
│   ├── middlewares/
│   │   ├── auth.middleware.js      ← JWT validate + raw SQL query
│   │   ├── validator.middleware.js ← Joi (definido, poco usado)
│   │   └── upload.middleware.js    ← Multer config
│   ├── models/
│   │   ├── index.js          ← Sequelize init (solo para conexión en server.js)
│   │   └── user.model.js     ← Modelo Sequelize legacy (NO usar para auth/users)
│   ├── routes/
│   │   ├── index.js          ← Agrega /auth, /users, /import
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   └── import.routes.js  ← [NUEVO]
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   └── import.service.js ← [NUEVO] Transacción DB
│   └── utils/
│       ├── db.js              ← [NUEVO] pg.Pool para raw SQL
│       ├── jwt.util.js        ← generateToken, verifyToken, decodeToken
│       ├── response.util.js   ← ResponseUtil: success, error, notFound, badRequest...
│       └── parsers/           ← [NUEVO]
│           ├── sampleDetails.parser.js
│           ├── allele.parser.js
│           └── consensus.parser.js
├── server.js                  ← Punto de entrada, inicia Sequelize + Express
├── .env                       ← Variables locales (no commitear)
├── .env.example               ← Template de variables
└── package.json
```

---

## API — Endpoints

**Base URL:** `http://localhost:3000/api/v1`

### Públicos
| Método | Ruta                   | Body                                      | Descripción         |
|--------|------------------------|-------------------------------------------|---------------------|
| GET    | `/health`              | —                                         | Health check        |
| GET    | `/api/v1`              | —                                         | Info de la API      |
| POST   | `/api/v1/auth/login`   | `{ username, password }`                  | Login → JWT token   |
| POST   | `/api/v1/users`        | `{ site_id, username, full_name, password, email? }` | Crear usuario |

### Protegidos (Bearer JWT)
| Método | Ruta                  | Descripción              |
|--------|-----------------------|--------------------------|
| GET    | `/api/v1/auth/profile`         | Perfil + screens del usuario |
| GET    | `/api/v1/users`                | Listar usuarios (`?site_id=`) |
| GET    | `/api/v1/users/:id`            | Usuario por ID + screens      |
| PUT    | `/api/v1/users/:id`            | Actualizar usuario            |
| DELETE | `/api/v1/users/:id`            | Eliminar usuario              |
| PUT    | `/api/v1/users/:id/permissions`| Reemplazar screens del usuario|
| POST   | `/api/v1/import/run`           | Importar muestra NGS (multipart)|

### Respuesta de usuario (todos los endpoints de users y auth)
```json
{
  "id": "uuid",
  "siteId": "uuid",
  "username": "jdoe",
  "fullName": "Juan Doe",
  "email": "juan@hospital.mx",
  "isActive": true,
  "screens": ["dashboard", "search", "import"],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### PUT /api/v1/users/:id/permissions
```json
// Request body:
{ "screens": ["dashboard", "search", "import", "expediente"] }

// Response:
{ "userId": "uuid", "screens": ["dashboard", "search", "import", "expediente"] }
```
El frontend gestiona qué vistas existen. El backend solo almacena y devuelve el array.

### POST /api/v1/import/run
```
Content-Type: multipart/form-data
Authorization: Bearer <JWT>

Campos:
  sampleDetails  (file, required)   — sampleDetailsLong.tsv
  alleles        (files[], optional) — 28 TSVs de alelos por sistema
  consensus      (files[], optional) — 26 CSVs de consensus por gen
  site_id        (string UUID, required)
  runDate        (string ISO, required)  ej: "2024-06-15"
  instrument     (string, optional)
  panelType      (string, default: "RBCPv3")
  donorId        (string UUID, optional)

Response 201:
{
  "success": true,
  "message": "Sample imported successfully",
  "data": {
    "runId": "uuid",
    "sampleId": "uuid",
    "sampleNumber": "23",
    "plate": "Geno",
    "phenotypesCount": 116,
    "allelesInserted": 340,
    "consensusInserted": 26,
    "validationStatus": "PENDING"
  }
}
```

---

## Comandos de base de datos

```bash
npm run db:migrate          # Corre todas las migraciones SQL pendientes
npm run db:migrate:status   # Muestra qué migraciones han corrido y cuáles faltan
npm run db:migrate:undo     # Revierte la última (requiere archivo _down.sql)
npm run db:migrate:reset    # Borra tracking y re-corre todo (DEV ONLY)
```

El runner (`scripts/db-migrate.js`) usa `pg` directamente y trackea ejecuciones
en la tabla `_migrations` de la DB. Solo procesa archivos `.sql` de `database/migrations/`
(ignora subdirectorios como `legacy/`).

> **IMPORTANTE:** NO usar `sequelize-cli db:migrate`. Los archivos SQL usan features
> de PostgreSQL (pgvector, DO $$ blocks, PARTITION BY) que Sequelize no soporta.

---

## Schema de base de datos (001–013)

> Archivos en `database/migrations/*.sql`. Correr con `npm run db:migrate`.
> La migración legacy JS fue movida a `database/migrations/legacy/` (no se ejecuta).

### Tablas principales

| Tabla                  | Descripción                                              |
|------------------------|----------------------------------------------------------|
| `sites`                | Bancos de sangre / sedes (multi-tenant)                  |
| `users`                | Usuarios por sede (NEW schema — NO la de Sequelize)      |
| `screen_permissions`   | Permisos CRUD por pantalla por usuario                   |
| `blood_group_systems`  | 45 sistemas ISBT (ABO, RH, KEL, FY, JK, etc.)           |
| `cat_antigenos`        | Catálogo de 444 antígenos con posición vector y peso clínico |
| `allele_definitions`   | Definición de alelos ISBT por gen                        |
| `sequencing_runs`      | Corridas de secuenciación (placa + fecha + instrumento)  |
| `samples`              | Muestras **particionadas por año** (2024–2027)           |
| `allele_calls`         | Llamadas de alelo por amplicon/posición cDNA             |
| `consensus_sequences`  | Secuencias consensus por gen                             |
| `audit.change_log`     | Log inmutable de cambios (NOM-253-SSA1)                  |
| `audit.activity_log`   | Log de actividad API                                     |
| `mv_current_donor_profiles` | Vista materializada de perfiles actuales de donadores |

### Columnas clave de `samples` (migración 013 — lowercase)
```
abo_type, rh_d, rh_cc (C), rh_c, rh_ee (E), rh_e
kel_kk (K), kel_k, kel_kpa, kel_kpb
fy_fya, fy_fyb, jk_jka, jk_jkb
mns_m, mns_n, mns_ss (S), mns_s, mns_u
di_dia, di_dib, do_doa, do_dob, co_coa, co_cob
antigen_phenotypes  JSONB   { "RhD": "+", "C": "0", ... }
genotypes           JSONB   { "GYPA_MN": "GYPA*02 / GYPA*02", ... }
fenotipo_vector     vector(444)   ← AUTO via trigger trg_samples_vector
fenotipo_ponderado  vector(444)   ← AUTO via trigger
fenotipo_bits       BIT(444)      ← AUTO via trigger
validation_status   PENDING | VALIDATED | REJECTED | REVIEW
```

### Función de búsqueda de compatibilidad
```sql
buscar_donantes_compatibles(p_abo_receptor, p_rh_receptor, p_fenotipos_receptor, ...)
-- Usa coseno similarity con fenotipo_ponderado o fenotipo_vector
-- Usa distancia Hamming con fenotipo_bits
```

---

## Patrones y convenciones del código

### Patrón de controllers
```js
class XController {
  async method(req, res, next) {
    try {
      const result = await xService.method(params);
      return ResponseUtil.success(res, result, 'Message', 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}
module.exports = new XController();
```

### Patrón de rutas
```js
const authenticate = require('../middlewares/auth.middleware');
router.post('/endpoint', authenticate, controller.method);
```

### Raw SQL (import / búsqueda)
- Usar `src/utils/db.js` → `pg.Pool`
- Para transacciones: `client = await pool.connect()` → `client.query('BEGIN')` → ... → `COMMIT` / `ROLLBACK` → `client.release()`

### Sequelize (auth / users legacy)
- Solo para `User.findByPk()` en auth middleware
- NO usar Sequelize para tablas de la nueva DB schema (samples, allele_calls, etc.)

---

## Variables de entorno requeridas

```env
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1
DB_HOST=localhost
DB_PORT=5432
DB_NAME=genomatch_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
```

---

## Notas importantes / Advertencias

1. **Dos schemas de usuarios coexisten:**
   - `user.model.js` (Sequelize) → tabla `users` legacy con `firstName`, `lastName`, `email`
   - SQL migration 003 → tabla `users` nueva con `username`, `full_name`, `site_id`
   - El `auth.middleware.js` usa el modelo Sequelize (legacy)
   - Los imports usan la tabla nueva via raw SQL

2. **Columnas sensibles a case en `samples`:**
   - Migración 013 forzó todo a lowercase — usar `rh_d` no `rh_D`
   - `rh_cc` = antígeno C (mayúscula), `rh_c` = antígeno c (minúscula)
   - `kel_kk` = antígeno K (mayúscula), `kel_k` = antígeno k (minúscula)

3. **Bug conocido en migración 011:**
   - `buscar_donantes_compatibles` usa `s.rh_D` (old name) en línea 56
   - Debe corregirse a `s.rh_d` antes de usar la función

4. **Triggers automáticos en `samples`:**
   - `trg_samples_vector` → auto-computa `fenotipo_vector`, `fenotipo_ponderado`, `fenotipo_bits`
   - `trg_audit_samples` → registra en `audit.change_log`
   - Ambos se aplican a todas las particiones (samples_2024, 2025, 2026, 2027)

5. **Particionamiento de `samples`:**
   - La tabla `samples` está particionada por `run_date` (año)
   - El `PRIMARY KEY` es `(id, run_date)` — siempre incluir `run_date` en queries

6. **HNSW indexes pendientes:**
   - Las migraciones mencionan pgvector HNSW pero nunca los crean
   - Para producción agregar: `CREATE INDEX ON samples USING hnsw (fenotipo_vector vector_cosine_ops)`

7. **`responseUtil` y `db.js`:**
   - `ResponseUtil` existe pero los controllers legacy no lo usan — los nuevos SÍ deben usarlo
   - `src/utils/db.js` es el nuevo pg.Pool para todo acceso raw SQL (import, búsqueda)

---

## Formato de archivos TSV (input del import)

### sampleDetailsLong.tsv (archivo principal)
```
SampleID  | Category           | Key                        | Value
--------- | ------------------ | -------------------------- | -----
RBC-23    | Metadata           | Plate                      | Geno
RBC-23    | Metadata           | snum                       | 23
RBC-23    | Metadata           | Panel QC;CORE              | PASS
RBC-23    | isbt_genotype      | CORE;GYPA;MN               | GYPA*02 / GYPA*02
RBC-23    | predicted_phenotype| CORE;GYPA;MN;M             | 0
RBC-23    | predicted_phenotype| CORE;RHD;Exon1;RhD         | +
```

### Valores de fenotipos
```
+    = Positivo
0    = Negativo
w    = Débil (weak)
AMB  = Ambiguo
UNX  = Inesperado
NA   = No aplica / no testeado
```

### alleles/*.tsv — bloques por sistema/gen
- Bloque por antigen group con amplicons (bases cDNA) + llamadas de alelos

### consensus/*.csv — bloques por exón
- Secuencias de DNA por posición proteica/cDNA con QC por posición
