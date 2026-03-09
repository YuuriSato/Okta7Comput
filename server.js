const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

// Carrega variaveis de ambiente locais.
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Parametros principais da API e regras globais.
const PORT = Number(process.env.API_PORT || process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const DB_SSL = String(process.env.DB_SSL || "true").toLowerCase() === "true";
const CORPORATE_EMAIL_DOMAIN = String(process.env.CORPORATE_EMAIL_DOMAIN || "okta7.com.br")
  .trim()
  .toLowerCase();
const AUTH_REQUIRE_PREAUTHORIZED_EMAIL = String(process.env.AUTH_REQUIRE_PREAUTHORIZED_EMAIL || "false").toLowerCase() === "true";

// Monta politica de CORS (origem unica ou lista separada por virgula).
function buildCorsOrigin() {
  const raw = String(process.env.API_CORS_ORIGIN || "*").trim();
  if (!raw || raw === "*") {
    return true;
  }

  const allowed = raw.split(",").map((item) => item.trim()).filter(Boolean);
  return (origin, callback) => {
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("CORS bloqueado para esta origem."));
  };
}

// Pool de conexoes MySQL reutilizado por toda a API.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: DB_SSL ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const app = express();
app.use(cors({ origin: buildCorsOrigin(), credentials: true }));
app.use(express.json());

// Helpers pequenos de sanitizacao/formato.
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function ensureCorporateEmailDomain(email) {
  if (!CORPORATE_EMAIL_DOMAIN) return true;
  return normalizeEmail(email).endsWith(`@${CORPORATE_EMAIL_DOMAIN}`);
}

function signAuthToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

// Converte linha do banco para o formato esperado pelo frontend.
function mapComputerRow(row) {
  return {
    id: String(row.id),
    owner: row.owner_name || "",
    serial: row.serial_number || "",
    machine: row.machine_model || "",
    deviceStatus: row.device_status || "ativo",
    corporateEmail: row.corporate_email || "",
    purchaseDate: row.purchase_date ? new Date(row.purchase_date).toISOString().slice(0, 10) : "",
    warrantyMonths: Number(row.warranty_months || 0),
    warrantyDays: Number(row.warranty_days || 0),
    cpu: row.cpu || "",
    ram: row.ram || "",
    gpu: row.gpu || "",
    storage: row.storage || "",
    storageType: row.storage_type || "SSD",
    os: row.operating_system || "",
    notes: row.notes || "",
    specs: row.specs || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

// Busca um computador por id (inclui email corporativo vinculado).
async function getComputerById(id) {
  const [rows] = await pool.execute(
    `SELECT c.*, ce.email AS corporate_email
     FROM computers c
     LEFT JOIN corporate_emails ce ON ce.id = c.corporate_email_id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return mapComputerRow(rows[0]);
}

async function getComputerSnapshotById(executor, id) {
  const [rows] = await executor.execute(
    `SELECT c.*, ce.email AS corporate_email
     FROM computers c
     LEFT JOIN corporate_emails ce ON ce.id = c.corporate_email_id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );
  return rows.length ? rows[0] : null;
}

function normalizeDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function buildComputerAuditShape(row) {
  if (!row) return null;
  return {
    owner: row.owner_name || "",
    serial: row.serial_number || "",
    machine: row.machine_model || "",
    deviceStatus: row.device_status || "ativo",
    corporateEmail: row.corporate_email || "",
    purchaseDate: normalizeDateOnly(row.purchase_date),
    warrantyMonths: Number(row.warranty_months || 0),
    warrantyDays: Number(row.warranty_days || 0),
    cpu: row.cpu || "",
    ram: row.ram || "",
    gpu: row.gpu || "",
    storage: row.storage || "",
    storageType: row.storage_type || "",
    os: row.operating_system || "",
    notes: row.notes || "",
    specs: row.specs || ""
  };
}

function buildComputerChangeSet(beforeRow, afterRow) {
  const before = buildComputerAuditShape(beforeRow);
  const after = buildComputerAuditShape(afterRow);
  const keys = Object.keys(after || {});
  const changedFields = {};

  keys.forEach((key) => {
    const prev = before ? before[key] : undefined;
    const next = after ? after[key] : undefined;
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changedFields[key] = { before: prev, after: next };
    }
  });

  return {
    changedFieldCount: Object.keys(changedFields).length,
    changedFields,
    before,
    after
  };
}

async function registerFlowEvent(executor, event) {
  const details = event.details ? JSON.stringify(event.details) : null;
  await executor.execute(
    `INSERT INTO computer_flow_history (
      computer_id,
      computer_serial,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      actor_email,
      note,
      details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.computerId || null,
      event.computerSerial || "",
      event.eventType,
      event.fromStatus || null,
      event.toStatus || null,
      event.actorUserId || null,
      event.actorEmail || "",
      event.note || null,
      details
    ]
  );
}

function mapFlowHistoryRow(row) {
  let details = null;
  if (row.details_json != null) {
    if (typeof row.details_json === "string") {
      try {
        details = JSON.parse(row.details_json);
      } catch (_error) {
        details = null;
      }
    } else {
      details = row.details_json;
    }
  }

  return {
    id: String(row.id),
    computerId: row.computer_id == null ? null : String(row.computer_id),
    computerSerial: row.computer_serial || "",
    eventType: row.event_type,
    fromStatus: row.from_status || null,
    toStatus: row.to_status || null,
    actorUserId: row.actor_user_id == null ? null : String(row.actor_user_id),
    actorEmail: row.actor_email || "",
    note: row.note || "",
    details,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function mapReturnRow(row) {
  return {
    id: String(row.id),
    computerId: String(row.computer_id),
    computerSerial: row.computer_serial || "",
    machine: row.machine_model || "",
    previousOwnerName: row.previous_owner_name || "",
    previousCorporateEmail: row.previous_corporate_email || "",
    returnedBy: row.returned_by || "",
    receivedByEmail: row.received_by_email || "",
    conditionStatus: row.condition_status || "bom",
    reason: row.reason || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

// Middleware de autenticacao JWT para proteger rotas privadas.
async function authRequired(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ message: "Token ausente." });
      return;
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, c.active
       FROM users u
       JOIN corporate_emails c ON c.id = u.corporate_email_id
       WHERE u.id = ?
       LIMIT 1`,
      [payload.sub]
    );

    if (!rows.length || !rows[0].active) {
      res.status(401).json({ message: "Sessao invalida." });
      return;
    }

    req.auth = { id: rows[0].id, email: rows[0].email, token };
    next();
  } catch (error) {
    res.status(401).json({ message: "Sessao invalida." });
  }
}

// Healthcheck: confirma API ativa e conexao com banco.
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "API online" });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Falha na conexao com banco." });
  }
});

// Auth: cadastra usuario, valida email corporativo e devolve token.
app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    res.status(400).json({ message: "Email e senha sao obrigatorios." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "Senha deve ter no minimo 6 caracteres." });
    return;
  }
  if (!ensureCorporateEmailDomain(email)) {
    res.status(400).json({ message: `Use um email corporativo @${CORPORATE_EMAIL_DOMAIN}.` });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingUser] = await connection.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existingUser.length) {
      await connection.rollback();
      res.status(409).json({ message: "Email ja cadastrado." });
      return;
    }

    let [corpRows] = await connection.execute(
      "SELECT id, active FROM corporate_emails WHERE email = ? LIMIT 1",
      [email]
    );

    if (!corpRows.length) {
      if (AUTH_REQUIRE_PREAUTHORIZED_EMAIL) {
        await connection.rollback();
        res.status(403).json({ message: "Email corporativo nao autorizado." });
        return;
      }

      const [insertCorp] = await connection.execute(
        "INSERT INTO corporate_emails (email, active) VALUES (?, 1)",
        [email]
      );
      corpRows = [{ id: insertCorp.insertId, active: 1 }];
    }

    if (!corpRows[0].active) {
      await connection.rollback();
      res.status(403).json({ message: "Email corporativo desativado." });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const [insertUser] = await connection.execute(
      "INSERT INTO users (corporate_email_id, email, password_hash) VALUES (?, ?, ?)",
      [corpRows[0].id, email, hash]
    );

    await connection.commit();
    const user = { id: Number(insertUser.insertId), email };
    const token = signAuthToken(user);
    res.status(201).json({ token, user: { email: user.email } });
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "Email ja cadastrado." });
      return;
    }
    res.status(500).json({ message: "Erro interno ao cadastrar usuario." });
  } finally {
    connection.release();
  }
});

// Auth: valida credenciais e emite novo token JWT.
app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    res.status(400).json({ message: "Email e senha sao obrigatorios." });
    return;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.password_hash, c.active
       FROM users u
       JOIN corporate_emails c ON c.id = u.corporate_email_id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      res.status(401).json({ message: "Credenciais invalidas." });
      return;
    }

    const user = rows[0];
    if (!user.active) {
      res.status(403).json({ message: "Email corporativo desativado." });
      return;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ message: "Credenciais invalidas." });
      return;
    }

    const token = signAuthToken({ id: Number(user.id), email: user.email });
    res.json({ token, user: { email: user.email } });
  } catch (error) {
    res.status(500).json({ message: "Erro interno ao autenticar." });
  }
});

// Auth: retorna dados basicos do usuario autenticado.
app.get("/api/auth/me", authRequired, async (req, res) => {
  res.json({ user: { email: req.auth.email } });
});

// Corporate emails: lista emails ativos e total de maquinas vinculadas.
app.get("/api/corporate-emails", authRequired, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ce.id, ce.email, ce.active, ce.created_at,
              COUNT(c.id) AS machine_count
       FROM corporate_emails ce
       LEFT JOIN computers c ON c.corporate_email_id = ce.id
       WHERE ce.active = 1
       GROUP BY ce.id, ce.email, ce.active, ce.created_at
       ORDER BY ce.created_at DESC`
    );

    const emails = rows.map((row) => ({
      id: String(row.id),
      email: row.email,
      active: !!row.active,
      machineCount: Number(row.machine_count || 0),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }));

    res.json({ emails });
  } catch (error) {
    res.status(500).json({ message: "Falha ao listar emails corporativos." });
  }
});

// Corporate emails: cria um email novo ou reativa email desativado.
app.post("/api/corporate-emails", authRequired, async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    res.status(400).json({ message: "Email e obrigatorio." });
    return;
  }
  if (!ensureCorporateEmailDomain(email)) {
    res.status(400).json({ message: `Use um email corporativo @${CORPORATE_EMAIL_DOMAIN}.` });
    return;
  }

  try {
    const [existing] = await pool.execute(
      "SELECT id, active FROM corporate_emails WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length && existing[0].active) {
      res.status(409).json({ message: "Este email ja foi cadastrado." });
      return;
    }

    if (existing.length && !existing[0].active) {
      await pool.execute("UPDATE corporate_emails SET active = 1 WHERE id = ?", [existing[0].id]);
      res.status(201).json({ email: { id: String(existing[0].id), email, active: true, machineCount: 0, createdAt: new Date().toISOString() } });
      return;
    }

    const [insert] = await pool.execute(
      "INSERT INTO corporate_emails (email, active) VALUES (?, 1)",
      [email]
    );

    res.status(201).json({
      email: {
        id: String(insert.insertId),
        email,
        active: true,
        machineCount: 0,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "Este email ja foi cadastrado." });
      return;
    }
    res.status(500).json({ message: "Falha ao adicionar email corporativo." });
  }
});

// Corporate emails: desativa email e limpa vinculo em computadores.
app.delete("/api/corporate-emails/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ message: "ID invalido." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      "SELECT id, email, active FROM corporate_emails WHERE id = ? LIMIT 1",
      [id]
    );

    if (!rows.length || !rows[0].active) {
      await connection.rollback();
      res.status(404).json({ message: "Email nao encontrado." });
      return;
    }

    await connection.execute(
      "UPDATE computers SET corporate_email_id = NULL WHERE corporate_email_id = ?",
      [id]
    );

    await connection.execute("UPDATE corporate_emails SET active = 0 WHERE id = ?", [id]);
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Falha ao remover email corporativo." });
  } finally {
    connection.release();
  }
});

// Normaliza payload recebido e calcula campos derivados (ex.: garantia em dias).
function normalizeComputerPayload(body = {}) {
  const payload = {
    owner: String(body.owner || "").trim(),
    serial: String(body.serial || "").trim(),
    machine: String(body.machine || "").trim(),
    deviceStatus: String(body.deviceStatus || "ativo").trim().toLowerCase(),
    corporateEmail: normalizeEmail(body.corporateEmail || ""),
    purchaseDate: String(body.purchaseDate || "").trim(),
    warrantyMonths: Number(body.warrantyMonths || 0),
    cpu: String(body.cpu || "").trim(),
    ram: String(body.ram || "").trim(),
    gpu: String(body.gpu || "").trim(),
    storage: String(body.storage || "").trim(),
    storageType: String(body.storageType || "SSD").trim(),
    os: String(body.os || "").trim(),
    notes: String(body.notes || "").trim(),
    specs: String(body.specs || "").trim()
  };

  if (!["ativo", "inativo", "pendente"].includes(payload.deviceStatus)) {
    payload.deviceStatus = "ativo";
  }

  if (!payload.specs) {
    const specParts = [payload.cpu, payload.ram, payload.gpu, payload.storage].filter(Boolean);
    payload.specs = specParts.join(" / ");
  }

  payload.warrantyDays = Number.isFinite(payload.warrantyMonths) && payload.warrantyMonths > 0
    ? Math.round(payload.warrantyMonths * 30)
    : 0;

  return payload;
}

// Resolve o email corporativo para chave estrangeira; falha se inativo/inexistente.
async function resolveCorporateEmailIdByEmail(connection, email) {
  if (!email) return null;
  const [rows] = await connection.execute(
    "SELECT id, active FROM corporate_emails WHERE email = ? LIMIT 1",
    [email]
  );
  if (!rows.length || !rows[0].active) {
    throw new Error("EMAIL_NOT_ALLOWED");
  }
  return Number(rows[0].id);
}

// Computers: lista inventario completo.
app.get("/api/computers", authRequired, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*, ce.email AS corporate_email
       FROM computers c
       LEFT JOIN corporate_emails ce ON ce.id = c.corporate_email_id
       ORDER BY c.created_at DESC`
    );

    res.json({ computers: rows.map(mapComputerRow) });
  } catch (error) {
    res.status(500).json({ message: "Falha ao listar computadores." });
  }
});

// Computers: cria novo computador no inventario.
app.post("/api/computers", authRequired, async (req, res) => {
  const payload = normalizeComputerPayload(req.body || {});

  if (!payload.owner || !payload.serial) {
    res.status(400).json({ message: "Dono e numero de serie sao obrigatorios." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const corporateEmailId = await resolveCorporateEmailIdByEmail(connection, payload.corporateEmail);

    const [insert] = await connection.execute(
      `INSERT INTO computers (
        owner_name,
        serial_number,
        machine_model,
        device_status,
        purchase_date,
        warranty_months,
        warranty_days,
        cpu,
        ram,
        gpu,
        storage,
        storage_type,
        operating_system,
        notes,
        specs,
        corporate_email_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.owner,
        payload.serial,
        payload.machine || null,
        payload.deviceStatus,
        payload.purchaseDate || null,
        payload.warrantyMonths,
        payload.warrantyDays,
        payload.cpu || null,
        payload.ram || null,
        payload.gpu || null,
        payload.storage || null,
        payload.storageType || null,
        payload.os || null,
        payload.notes || null,
        payload.specs || "",
        corporateEmailId
      ]
    );

    const createdSnapshot = await getComputerSnapshotById(connection, insert.insertId);
    if (!createdSnapshot) {
      await connection.rollback();
      res.status(500).json({ message: "Falha ao carregar computador criado." });
      return;
    }

    await registerFlowEvent(connection, {
      computerId: Number(insert.insertId),
      computerSerial: createdSnapshot.serial_number,
      eventType: "create",
      fromStatus: null,
      toStatus: createdSnapshot.device_status,
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      note: "Cadastro inicial do computador.",
      details: {
        after: buildComputerAuditShape(createdSnapshot)
      }
    });

    await connection.commit();
    res.status(201).json({ computer: mapComputerRow(createdSnapshot) });
  } catch (error) {
    await connection.rollback();
    if (error.message === "EMAIL_NOT_ALLOWED") {
      res.status(400).json({ message: "Email corporativo nao autorizado." });
      return;
    }
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "Numero de serie ja cadastrado." });
      return;
    }
    res.status(500).json({ message: "Falha ao criar computador." });
  } finally {
    connection.release();
  }
});

// Computers: atualiza um computador existente por id.
app.put("/api/computers/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ message: "ID invalido." });
    return;
  }

  const payload = normalizeComputerPayload(req.body || {});
  if (!payload.owner || !payload.serial) {
    res.status(400).json({ message: "Dono e numero de serie sao obrigatorios." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const beforeSnapshot = await getComputerSnapshotById(connection, id);
    if (!beforeSnapshot) {
      await connection.rollback();
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    const corporateEmailId = await resolveCorporateEmailIdByEmail(connection, payload.corporateEmail);

    const [updateResult] = await connection.execute(
      `UPDATE computers
       SET owner_name = ?,
           serial_number = ?,
           machine_model = ?,
           device_status = ?,
           purchase_date = ?,
           warranty_months = ?,
           warranty_days = ?,
           cpu = ?,
           ram = ?,
           gpu = ?,
           storage = ?,
           storage_type = ?,
           operating_system = ?,
           notes = ?,
           specs = ?,
           corporate_email_id = ?
       WHERE id = ?`,
      [
        payload.owner,
        payload.serial,
        payload.machine || null,
        payload.deviceStatus,
        payload.purchaseDate || null,
        payload.warrantyMonths,
        payload.warrantyDays,
        payload.cpu || null,
        payload.ram || null,
        payload.gpu || null,
        payload.storage || null,
        payload.storageType || null,
        payload.os || null,
        payload.notes || null,
        payload.specs || "",
        corporateEmailId,
        id
      ]
    );

    if (!updateResult.affectedRows) {
      await connection.rollback();
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    const afterSnapshot = await getComputerSnapshotById(connection, id);
    if (!afterSnapshot) {
      await connection.rollback();
      res.status(500).json({ message: "Falha ao carregar computador atualizado." });
      return;
    }

    const changeSet = buildComputerChangeSet(beforeSnapshot, afterSnapshot);
    await registerFlowEvent(connection, {
      computerId: id,
      computerSerial: afterSnapshot.serial_number,
      eventType: "update",
      fromStatus: beforeSnapshot.device_status,
      toStatus: afterSnapshot.device_status,
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      note: changeSet.changedFieldCount
        ? `Atualizacao com ${changeSet.changedFieldCount} campo(s) alterado(s).`
        : "Atualizacao sem alteracao de campos relevantes.",
      details: changeSet
    });

    await connection.commit();
    res.json({ computer: mapComputerRow(afterSnapshot) });
  } catch (error) {
    await connection.rollback();
    if (error.message === "EMAIL_NOT_ALLOWED") {
      res.status(400).json({ message: "Email corporativo nao autorizado." });
      return;
    }
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "Numero de serie ja cadastrado." });
      return;
    }
    res.status(500).json({ message: "Falha ao atualizar computador." });
  } finally {
    connection.release();
  }
});

// Computers: remove um computador por id.
app.delete("/api/computers/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ message: "ID invalido." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const beforeSnapshot = await getComputerSnapshotById(connection, id);
    if (!beforeSnapshot) {
      await connection.rollback();
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    await registerFlowEvent(connection, {
      computerId: id,
      computerSerial: beforeSnapshot.serial_number,
      eventType: "delete",
      fromStatus: beforeSnapshot.device_status,
      toStatus: null,
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      note: "Computador removido do inventario.",
      details: {
        before: buildComputerAuditShape(beforeSnapshot)
      }
    });

    const [result] = await connection.execute("DELETE FROM computers WHERE id = ?", [id]);
    if (!result.affectedRows) {
      await connection.rollback();
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Falha ao remover computador." });
  } finally {
    connection.release();
  }
});

// Computers: retorna historico de alteracoes de um item.
app.get("/api/computers/:id/history", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ message: "ID invalido." });
    return;
  }

  try {
    const [computerRows] = await pool.execute(
      "SELECT id, serial_number FROM computers WHERE id = ? LIMIT 1",
      [id]
    );
    if (!computerRows.length) {
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    const serial = computerRows[0].serial_number;
    const [rows] = await pool.execute(
      `SELECT *
       FROM computer_flow_history
       WHERE computer_id = ? OR computer_serial = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 200`,
      [id, serial]
    );

    res.json({ history: rows.map(mapFlowHistoryRow) });
  } catch (error) {
    res.status(500).json({ message: "Falha ao carregar historico do computador." });
  }
});

// Fluxo: lista historico global de alteracoes do inventario.
app.get("/api/flow-history", authRequired, async (req, res) => {
  const rawLimit = Number(req.query?.limit || 200);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(500, Math.trunc(rawLimit)))
    : 200;

  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM computer_flow_history
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [limit]
    );
    res.json({ history: rows.map(mapFlowHistoryRow) });
  } catch (error) {
    res.status(500).json({ message: "Falha ao carregar historico de alteracoes." });
  }
});

// Devolucoes: lista historico de devolucoes processadas.
app.get("/api/returns", authRequired, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, c.machine_model
       FROM computer_returns r
       LEFT JOIN computers c ON c.id = r.computer_id
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 300`
    );
    res.json({ returns: rows.map(mapReturnRow) });
  } catch (error) {
    res.status(500).json({ message: "Falha ao listar devolucoes." });
  }
});

// Devolucoes: processa retorno do equipamento para estoque/triagem.
app.post("/api/returns", authRequired, async (req, res) => {
  const computerId = Number(req.body?.computerId);
  const returnedBy = String(req.body?.returnedBy || "").trim();
  const conditionStatus = String(req.body?.conditionStatus || "bom").trim().toLowerCase();
  const reason = String(req.body?.reason || "").trim();

  if (!Number.isFinite(computerId) || computerId <= 0) {
    res.status(400).json({ message: "Computador invalido para devolucao." });
    return;
  }
  if (!returnedBy) {
    res.status(400).json({ message: "Informe quem realizou a devolucao." });
    return;
  }
  if (!["bom", "avariado", "manutencao"].includes(conditionStatus)) {
    res.status(400).json({ message: "Condicao de devolucao invalida." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const beforeSnapshot = await getComputerSnapshotById(connection, computerId);
    if (!beforeSnapshot) {
      await connection.rollback();
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    const nextStatus = conditionStatus === "bom" ? "inativo" : "pendente";
    const returnNote = `[DEVOLUCAO] ${new Date().toISOString().slice(0, 10)} - ${returnedBy} (${conditionStatus})${reason ? `: ${reason}` : ""}`;
    const mergedNotes = beforeSnapshot.notes
      ? `${beforeSnapshot.notes}\n${returnNote}`
      : returnNote;

    await connection.execute(
      `UPDATE computers
       SET owner_name = ?,
           device_status = ?,
           corporate_email_id = NULL,
           notes = ?
       WHERE id = ?`,
      ["Estoque", nextStatus, mergedNotes, computerId]
    );

    const [insertReturn] = await connection.execute(
      `INSERT INTO computer_returns (
        computer_id,
        computer_serial,
        previous_owner_name,
        previous_corporate_email,
        returned_by,
        received_by_email,
        condition_status,
        reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        computerId,
        beforeSnapshot.serial_number,
        beforeSnapshot.owner_name || null,
        beforeSnapshot.corporate_email || null,
        returnedBy,
        req.auth.email,
        conditionStatus,
        reason || null
      ]
    );

    const [returnRows] = await connection.execute(
      `SELECT r.*, c.machine_model
       FROM computer_returns r
       LEFT JOIN computers c ON c.id = r.computer_id
       WHERE r.id = ?
       LIMIT 1`,
      [insertReturn.insertId]
    );

    const afterSnapshot = await getComputerSnapshotById(connection, computerId);
    if (!afterSnapshot || !returnRows.length) {
      await connection.rollback();
      res.status(500).json({ message: "Falha ao finalizar devolucao." });
      return;
    }

    await registerFlowEvent(connection, {
      computerId,
      computerSerial: beforeSnapshot.serial_number,
      eventType: "return",
      fromStatus: beforeSnapshot.device_status,
      toStatus: afterSnapshot.device_status,
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      note: "Devolucao registrada no fluxo de inventario.",
      details: {
        returnId: String(insertReturn.insertId),
        returnedBy,
        receivedByEmail: req.auth.email,
        conditionStatus,
        reason,
        previousOwnerName: beforeSnapshot.owner_name || "",
        previousCorporateEmail: beforeSnapshot.corporate_email || ""
      }
    });

    await connection.commit();
    res.status(201).json({
      return: mapReturnRow(returnRows[0]),
      computer: mapComputerRow(afterSnapshot)
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Falha ao processar devolucao." });
  } finally {
    connection.release();
  }
});

// Em deploy, o mesmo processo serve frontend estatico e API.
app.use(express.static(__dirname));
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Tratamento centralizado para erros de CORS e falhas inesperadas.
app.use((err, _req, res, _next) => {
  if (err && err.message && String(err.message).includes("CORS")) {
    res.status(403).json({ message: err.message });
    return;
  }
  res.status(500).json({ message: "Erro interno inesperado." });
});

// Inicializacao do servidor HTTP.
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
