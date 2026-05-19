require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      service: 'auditoria-trazabilidad-ms',
      timestamp: new Date().toISOString(),
      database: 'up',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'auditoria-trazabilidad-ms',
      timestamp: new Date().toISOString(),
      database: 'down',
      message: 'No se pudo conectar a la base de datos',
    });
  }
});

app.get('/api/auditoria/usuarios', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT DISTINCT
        u.id,
        u.correo,
        u."nombreUsuario",
        u.nombres,
        u.apellidos
      FROM auditorias a
      LEFT JOIN usuarios u ON u.id = a."usuarioId"
      WHERE a."usuarioId" IS NOT NULL
      ORDER BY u.nombres ASC, u.apellidos ASC, u.correo ASC
      `,
    );

    res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auditoria/registros', async (req, res, next) => {
  try {
    const {
      usuarioId,
      tipoEntidad,
      fechaDesde,
      fechaHasta,
      q,
      page,
      pageSize,
    } = req.query;

    const currentPage = parsePositiveInt(page, 1);
    const currentPageSize = Math.min(parsePositiveInt(pageSize, 20), 100);
    const offset = (currentPage - 1) * currentPageSize;

    const whereClauses = [];
    const filtersParams = [];
    const pushParam = (value) => {
      filtersParams.push(value);
      return `$${filtersParams.length}`;
    };

    if (usuarioId) {
      whereClauses.push(`a."usuarioId" = ${pushParam(usuarioId)}`);
    }

    if (tipoEntidad) {
      whereClauses.push(`a."tipoEntidad" = ${pushParam(tipoEntidad)}`);
    }

    if (fechaDesde) {
      whereClauses.push(`a."creadoEn" >= ${pushParam(fechaDesde)}`);
    }

    if (fechaHasta) {
      whereClauses.push(`a."creadoEn" <= ${pushParam(fechaHasta)}`);
    }

    if (q) {
      const qParam = `%${String(q).trim()}%`;
      whereClauses.push(`(
        a.accion ILIKE ${pushParam(qParam)} OR
        a."tipoEntidad" ILIKE ${pushParam(qParam)} OR
        a."entidadId" ILIKE ${pushParam(qParam)} OR
        u.nombres ILIKE ${pushParam(qParam)} OR
        u.apellidos ILIKE ${pushParam(qParam)} OR
        u.correo ILIKE ${pushParam(qParam)}
      )`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM auditorias a
      LEFT JOIN usuarios u ON u.id = a."usuarioId"
      ${whereSql}
    `;

    const dataParams = [...filtersParams];
    const limitPlaceholder = `$${dataParams.length + 1}`;
    const offsetPlaceholder = `$${dataParams.length + 2}`;

    const dataQuery = `
      SELECT
        a.id,
        a."usuarioId",
        a."tipoEntidad",
        a."entidadId",
        a.accion,
        a."valoresAnteriores",
        a."valoresNuevos",
        a."direccionIp",
        a."userAgent",
        a."creadoEn",
        u.id AS "usuarioDbId",
        u.nombres,
        u.apellidos,
        u.correo,
        u."nombreUsuario"
      FROM auditorias a
      LEFT JOIN usuarios u ON u.id = a."usuarioId"
      ${whereSql}
      ORDER BY a."creadoEn" DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `;

    dataParams.push(currentPageSize, offset);

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, filtersParams),
      pool.query(dataQuery, dataParams),
    ]);

    const total = countResult.rows[0]?.total || 0;

    res.json({
      ok: true,
      data: dataResult.rows.map((row) => ({
        id: row.id,
        usuarioId: row.usuarioId,
        tipoEntidad: row.tipoEntidad,
        entidadId: row.entidadId,
        accion: row.accion,
        valoresAnteriores: row.valoresAnteriores,
        valoresNuevos: row.valoresNuevos,
        direccionIp: row.direccionIp,
        userAgent: row.userAgent,
        creadoEn: row.creadoEn,
        usuario: row.usuarioDbId
          ? {
              id: row.usuarioDbId,
              nombres: row.nombres,
              apellidos: row.apellidos,
              correo: row.correo,
              nombreUsuario: row.nombreUsuario,
            }
          : null,
      })),
      meta: {
        page: currentPage,
        pageSize: currentPageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / currentPageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auditoria/registros/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        a.id,
        a."usuarioId",
        a."tipoEntidad",
        a."entidadId",
        a.accion,
        a."valoresAnteriores",
        a."valoresNuevos",
        a."direccionIp",
        a."userAgent",
        a."creadoEn",
        u.id AS "usuarioDbId",
        u.nombres,
        u.apellidos,
        u.correo,
        u."nombreUsuario"
      FROM auditorias a
      LEFT JOIN usuarios u ON u.id = a."usuarioId"
      WHERE a.id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        message: 'Registro de auditoría no encontrado',
      });
    }

    const row = result.rows[0];

    return res.json({
      ok: true,
      data: {
        id: row.id,
        usuarioId: row.usuarioId,
        tipoEntidad: row.tipoEntidad,
        entidadId: row.entidadId,
        accion: row.accion,
        valoresAnteriores: row.valoresAnteriores,
        valoresNuevos: row.valoresNuevos,
        direccionIp: row.direccionIp,
        userAgent: row.userAgent,
        creadoEn: row.creadoEn,
        usuario: row.usuarioDbId
          ? {
              id: row.usuarioDbId,
              nombres: row.nombres,
              apellidos: row.apellidos,
              correo: row.correo,
              nombreUsuario: row.nombreUsuario,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error('[auditoria-ms] error:', error);
  res.status(500).json({
    ok: false,
    message: 'Error interno del microservicio de auditoría',
  });
});

const port = Number(process.env.AUDIT_MS_PORT || 3002);
app.listen(port, () => {
  console.log(`[auditoria-ms] corriendo en http://localhost:${port}`);
});
