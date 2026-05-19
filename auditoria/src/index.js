require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

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

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getAuthenticatedUserId(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (!token) {
    throw createHttpError(401, 'Token de autenticación requerido');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    if (!payload?.sub) {
      throw createHttpError(401, 'Token inválido');
    }
    return payload.sub;
  } catch (error) {
    if (error.status) throw error;
    throw createHttpError(401, 'Token inválido o expirado');
  }
}

function parseDateRange(query) {
  const range = {};
  const fechaDesde = query.fechaDesde ? new Date(String(query.fechaDesde)) : null;
  const fechaHasta = query.fechaHasta ? new Date(String(query.fechaHasta)) : null;

  if (fechaDesde && Number.isNaN(fechaDesde.getTime())) {
    throw createHttpError(400, 'La fecha desde no es válida');
  }

  if (fechaHasta && Number.isNaN(fechaHasta.getTime())) {
    throw createHttpError(400, 'La fecha hasta no es válida');
  }

  if (fechaDesde) {
    fechaDesde.setUTCHours(0, 0, 0, 0);
    range.fechaDesde = fechaDesde;
  }

  if (fechaHasta) {
    fechaHasta.setUTCHours(23, 59, 59, 999);
    range.fechaHasta = fechaHasta;
  }

  if (
    range.fechaDesde &&
    range.fechaHasta &&
    range.fechaDesde.getTime() > range.fechaHasta.getTime()
  ) {
    throw createHttpError(400, 'La fecha desde no puede ser posterior a la fecha hasta');
  }

  return range;
}

function formatMovementType(type) {
  const labels = {
    REGISTRO: 'Registro',
    ASIGNACION: 'Asignación',
    TRANSFERENCIA: 'Transferencia',
    DEVOLUCION: 'Devolución',
    BAJA: 'Baja',
    ACTUALIZACION: 'Actualización',
    INCIDENTE: 'Incidente',
  };

  return labels[type] || type;
}

function buildMovementTypeSummary(rows) {
  const summary = {
    REGISTRO: 0,
    ASIGNACION: 0,
    TRANSFERENCIA: 0,
    DEVOLUCION: 0,
    BAJA: 0,
    ACTUALIZACION: 0,
    INCIDENTE: 0,
  };

  rows.forEach((row) => {
    if (summary[row.tipo] !== undefined) {
      summary[row.tipo] += 1;
    }
  });

  return summary;
}

function buildFullName(row, prefix = '') {
  return [row[`${prefix}Nombres`], row[`${prefix}Apellidos`]]
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function assertUserHasPermission(userId, permissionCode) {
  const result = await pool.query(
    `
    SELECT 1
    FROM usuarios u
    JOIN roles r ON r.id = u."rolId"
    JOIN roles_permisos rp ON rp."rolId" = r.id
    JOIN permisos p ON p.id = rp."permisoId"
    WHERE u.id = $1 AND p.codigo = $2
    LIMIT 1
    `,
    [userId, permissionCode],
  );

  if (!result.rows.length) {
    throw createHttpError(403, 'No tienes permisos para consultar la trazabilidad departamental');
  }
}

async function resolveUserAreaIds(userId) {
  const result = await pool.query(
    `
    SELECT DISTINCT area_id
    FROM (
      SELECT u."areaId" AS area_id
      FROM usuarios u
      WHERE u.id = $1
      UNION
      SELECT a.id AS area_id
      FROM areas a
      WHERE a."encargadoId" = $1
    ) scope
    WHERE area_id IS NOT NULL
    `,
    [userId],
  );

  return result.rows.map((row) => row.area_id);
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

app.get('/api/auditoria/departamental/trazabilidad', async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    await assertUserHasPermission(userId, 'ASSET_VIEW');

    const areaIds = await resolveUserAreaIds(userId);
    if (!areaIds.length) {
      return res.json({
        ok: true,
        data: {
          areaIds,
          resumen: {
            totalMovimientos: 0,
            totalActivos: 0,
            movimientosPorTipo: buildMovementTypeSummary([]),
          },
          movimientos: [],
        },
      });
    }

    const { fechaDesde, fechaHasta } = parseDateRange(req.query);
    const { tipoMovimiento } = req.query;

    const whereClauses = [
      `(
        ac."areaActualId" = ANY($1::text[]) OR
        m."areaOrigenId" = ANY($1::text[]) OR
        m."areaDestinoId" = ANY($1::text[])
      )`,
    ];
    const params = [areaIds];
    const pushParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (tipoMovimiento) {
      whereClauses.push(`m.tipo = ${pushParam(String(tipoMovimiento))}`);
    }

    if (fechaDesde) {
      whereClauses.push(`m."creadoEn" >= ${pushParam(fechaDesde)}`);
    }

    if (fechaHasta) {
      whereClauses.push(`m."creadoEn" <= ${pushParam(fechaHasta)}`);
    }

    const result = await pool.query(
      `
      SELECT
        m.id,
        m.tipo,
        m."areaOrigenId",
        m."areaDestinoId",
        m."usuarioOrigenId",
        m."usuarioDestinoId",
        m."asignacionId",
        m.detalle,
        m."creadoEn",
        ac.id AS "activoId",
        ac.codigo AS "activoCodigo",
        ac.nombre AS "activoNombre",
        ac.estado AS "activoEstado",
        area_actual.id AS "areaActualId",
        area_actual.nombre AS "areaActualNombre",
        area_origen.id AS "areaOrigenDbId",
        area_origen.nombre AS "areaOrigenNombre",
        area_destino.id AS "areaDestinoDbId",
        area_destino.nombre AS "areaDestinoNombre",
        realizado_por.id AS "realizadoPorId",
        realizado_por.nombres AS "realizadoPorNombres",
        realizado_por.apellidos AS "realizadoPorApellidos"
      FROM movimientos_activos m
      JOIN activos ac ON ac.id = m."activoId"
      LEFT JOIN areas area_actual ON area_actual.id = ac."areaActualId"
      LEFT JOIN areas area_origen ON area_origen.id = m."areaOrigenId"
      LEFT JOIN areas area_destino ON area_destino.id = m."areaDestinoId"
      LEFT JOIN usuarios realizado_por ON realizado_por.id = m."realizadoPorId"
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY m."creadoEn" DESC
      `,
      params,
    );

    const movimientos = result.rows.map((row) => ({
      id: row.id,
      fuente: 'MOVIMIENTO',
      fecha: row.creadoEn,
      tipo: row.tipo,
      etiqueta: formatMovementType(row.tipo),
      detalle: row.detalle || 'Sin detalle registrado',
      activo: {
        id: row.activoId,
        codigo: row.activoCodigo,
        nombre: row.activoNombre,
        estado: row.activoEstado,
        areaActual: row.areaActualId
          ? { id: row.areaActualId, nombre: row.areaActualNombre }
          : null,
      },
      areaOrigen: row.areaOrigenDbId
        ? { id: row.areaOrigenDbId, nombre: row.areaOrigenNombre }
        : null,
      areaDestino: row.areaDestinoDbId
        ? { id: row.areaDestinoDbId, nombre: row.areaDestinoNombre }
        : null,
      usuarioOrigen: null,
      usuarioDestino: null,
      usuarioOrigenId: row.usuarioOrigenId,
      usuarioDestinoId: row.usuarioDestinoId,
      asignacionId: row.asignacionId,
      realizadoPor: row.realizadoPorId
        ? {
            id: row.realizadoPorId,
            nombreCompleto: buildFullName(row, 'realizadoPor'),
          }
        : null,
    }));

    return res.json({
      ok: true,
      data: {
        areaIds,
        resumen: {
          totalMovimientos: movimientos.length,
          totalActivos: new Set(movimientos.map((movimiento) => movimiento.activo.id)).size,
          movimientosPorTipo: buildMovementTypeSummary(movimientos),
        },
        movimientos,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error('[auditoria-ms] error:', error);
  res.status(error.status || 500).json({
    ok: false,
    message: error.status
      ? error.message
      : 'Error interno del microservicio de auditoría',
  });
});

const port = Number(process.env.AUDIT_MS_PORT || 3002);
app.listen(port, () => {
  console.log(`[auditoria-ms] corriendo en http://localhost:${port}`);
});
