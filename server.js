const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const { OAuth2Client } = require("google-auth-library");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.API_PORT || process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const DB_SSL = String(process.env.DB_SSL || "true").toLowerCase() === "true";
const DB_AUTO_APPLY_SCHEMA = String(process.env.DB_AUTO_APPLY_SCHEMA || "true").toLowerCase() === "true";
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_AUTH_ENABLED = Boolean(GOOGLE_CLIENT_ID);
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((item) => normalizeEmail(item))
  .filter(Boolean);
const CORPORATE_EMAIL_DOMAIN = String(process.env.CORPORATE_EMAIL_DOMAIN || "okta7.com.br")
  .trim()
  .toLowerCase();
const AUTH_REQUIRE_PREAUTHORIZED_EMAIL = String(process.env.AUTH_REQUIRE_PREAUTHORIZED_EMAIL || "false").toLowerCase() === "true";

function parseDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_URL;
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname) return null;

    const pathname = parsed.pathname.replace(/^\//, "").trim();
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      database: pathname || undefined,
      user: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || "")
    };
  } catch (error) {
    console.error("DB_URL_PARSE_ERROR", error.message);
    return null;
  }
}

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

const databaseUrlConfig = parseDatabaseUrl();

const pool = mysql.createPool({
  host: process.env.DB_HOST || databaseUrlConfig?.host,
  port: Number(process.env.DB_PORT || databaseUrlConfig?.port || 3306),
  database: process.env.DB_NAME || databaseUrlConfig?.database,
  user: process.env.DB_USER || databaseUrlConfig?.user,
  password: process.env.DB_PASS || databaseUrlConfig?.password,
  ssl: DB_SSL ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const googleClient = GOOGLE_AUTH_ENABLED ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const app = express();
app.use(cors({ origin: buildCorsOrigin(), credentials: true }));
app.use(express.json());

async function applySchemaOnStartup() {
  if (!DB_AUTO_APPLY_SCHEMA) return;

  const schemaPath = path.join(__dirname, "mysql-schema.sql");
  const sql = require("fs").readFileSync(schemaPath, "utf8");
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || databaseUrlConfig?.host,
    port: Number(process.env.DB_PORT || databaseUrlConfig?.port || 3306),
    database: process.env.DB_NAME || databaseUrlConfig?.database,
    user: process.env.DB_USER || databaseUrlConfig?.user,
    password: process.env.DB_PASS || databaseUrlConfig?.password,
    ssl: DB_SSL ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true
  });

  try {
    await connection.query(sql);
    console.log("DB_SCHEMA_APPLIED");
  } finally {
    await connection.end();
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(normalizeEmail(email));
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase() === "admin" ? "admin" : "member";
}

function ensureCorporateEmailDomain(email) {
  if (!CORPORATE_EMAIL_DOMAIN) return true;
  return normalizeEmail(email).endsWith(`@${CORPORATE_EMAIL_DOMAIN}`);
}

function signAuthToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function createOauthPasswordPlaceholder() {
  return bcrypt.hash(`oauth:${Date.now()}:${Math.random().toString(36).slice(2)}`, 10);
}

function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

function mapComputerRow(row) {
  return {
    id: String(row.id),
    owner: row.owner_name || "",
    company: row.company_name || "",
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

function mapComputerMovementRow(row) {
  return {
    id: String(row.id),
    computerId: String(row.computer_id),
    movementType: row.movement_type || "devolucao",
    serial: row.serial_number || "",
    machine: row.machine_model || "",
    previousOwner: row.previous_owner || "",
    previousCompany: row.previous_company_name || "",
    previousCorporateEmail: row.previous_corporate_email || "",
    previousDeviceStatus: row.previous_device_status || "ativo",
    nextOwner: row.next_owner || "",
    nextCompany: row.next_company_name || "",
    nextCorporateEmail: row.next_corporate_email || "",
    nextDeviceStatus: row.next_device_status || "ativo",
    reason: row.reason || "",
    createdByEmail: row.created_by_email || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

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

async function listComputerMovements() {
  const [rows] = await pool.execute(
    `SELECT cm.*, c.serial_number, c.machine_model
     FROM computer_movements cm
     JOIN computers c ON c.id = cm.computer_id
     ORDER BY cm.created_at DESC, cm.id DESC
     LIMIT 200`
  );

  return rows.map(mapComputerMovementRow);
}

async function getMovementById(connection, id) {
  const executor = connection || pool;
  const [rows] = await executor.execute(
    `SELECT cm.*, c.serial_number, c.machine_model
     FROM computer_movements cm
     JOIN computers c ON c.id = cm.computer_id
     WHERE cm.id = ?
     LIMIT 1`,
    [id]
  );
  return rows.length ? rows[0] : null;
}

async function isLatestMovementForComputer(connection, movement) {
  const executor = connection || pool;
  const [rows] = await executor.execute(
    `SELECT id
     FROM computer_movements
     WHERE computer_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [movement.computer_id]
  );
  return rows.length && Number(rows[0].id) === Number(movement.id);
}

async function countUsers(connection) {
  const executor = connection || pool;
  const [rows] = await executor.execute("SELECT COUNT(*) AS total FROM users");
  return Number(rows[0]?.total || 0);
}

async function decideUserRole(connection, email, explicitRole = "") {
  if (normalizeRole(explicitRole) === "admin") return "admin";
  if (isAdminEmail(email)) return "admin";
  const totalUsers = await countUsers(connection);
  return totalUsers === 0 ? "admin" : "member";
}

async function writeAuditLog({
  connection = null,
  actorUserId = null,
  actorEmail = "",
  actionType,
  entityType,
  entityId = "",
  description,
  metadata = null
}) {
  const executor = connection || pool;
  await executor.execute(
    `INSERT INTO audit_logs (
      actor_user_id,
      actor_email,
      action_type,
      entity_type,
      entity_id,
      description,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      actorUserId || null,
      actorEmail || null,
      actionType,
      entityType,
      entityId || null,
      description,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
}

async function ensureCorporateEmailRecord(connection, email) {
  let [corpRows] = await connection.execute(
    "SELECT id, active FROM corporate_emails WHERE email = ? LIMIT 1",
    [email]
  );

  if (!corpRows.length) {
    if (AUTH_REQUIRE_PREAUTHORIZED_EMAIL) {
      throw new Error("EMAIL_NOT_ALLOWED");
    }

    const [insertCorp] = await connection.execute(
      "INSERT INTO corporate_emails (email, active) VALUES (?, 1)",
      [email]
    );
    corpRows = [{ id: insertCorp.insertId, active: 1 }];
  }

  if (!corpRows[0].active) {
    throw new Error("EMAIL_DISABLED");
  }

  return Number(corpRows[0].id);
}

async function upsertOAuthUser({ email, provider, providerSubject }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const corporateEmailId = await ensureCorporateEmailRecord(connection, email);
    const [existingByEmail] = await connection.execute(
      "SELECT id, email, role_name FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    let userId;
    let roleName;
    if (existingByEmail.length) {
      userId = Number(existingByEmail[0].id);
      roleName = normalizeRole(existingByEmail[0].role_name);
      await connection.execute(
        `UPDATE users
         SET corporate_email_id = ?,
             auth_provider = ?,
             provider_subject = ?,
             email = ?
         WHERE id = ?`,
        [corporateEmailId, provider, providerSubject, email, userId]
      );
    } else {
      roleName = await decideUserRole(connection, email);
      const passwordHash = await createOauthPasswordPlaceholder();
      const [insertUser] = await connection.execute(
        `INSERT INTO users (
          corporate_email_id,
          email,
          password_hash,
          auth_provider,
          provider_subject,
          role_name
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [corporateEmailId, email, passwordHash, provider, providerSubject, roleName]
      );
      userId = Number(insertUser.insertId);
    }

    await writeAuditLog({
      connection,
      actorUserId: userId,
      actorEmail: email,
      actionType: existingByEmail.length ? "auth.google.login" : "auth.google.register",
      entityType: "user",
      entityId: String(userId),
      description: existingByEmail.length
        ? `Login com Google realizado por ${email}.`
        : `Usuario ${email} criado via Google Login.`,
      metadata: { provider, roleName }
    });

    await connection.commit();
    return { id: userId, email, role: roleName };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function authRequired(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ message: "Token ausente." });
      return;
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.role_name, c.active
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

    req.auth = { id: rows[0].id, email: rows[0].email, role: normalizeRole(rows[0].role_name), token };
    next();
  } catch (error) {
    res.status(401).json({ message: "Sessao invalida." });
  }
}

function adminRequired(req, res, next) {
  if (req.auth?.role !== "admin") {
    res.status(403).json({ message: "Permissao de administrador necessaria." });
    return;
  }
  next();
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "API online" });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Falha na conexao com banco." });
  }
});

app.get("/api/auth/config", (_req, res) => {
  res.json({
    provider: GOOGLE_AUTH_ENABLED ? "google" : "local",
    googleClientId: GOOGLE_AUTH_ENABLED ? GOOGLE_CLIENT_ID : "",
    corporateEmailDomain: CORPORATE_EMAIL_DOMAIN
  });
});

app.options("/api/auth/register", cors());
app.post("/api/auth/register", async (req, res) => {
  if (GOOGLE_AUTH_ENABLED) {
    res.status(405).json({ message: "Use o login com Google." });
    return;
  }

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

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingUser] = await connection.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existingUser.length) {
      await connection.rollback();
      res.status(409).json({ message: "Email ja cadastrado." });
      return;
    }

    const corporateEmailId = await ensureCorporateEmailRecord(connection, email);
    if (!corporateEmailId) {
      await connection.rollback();
      res.status(403).json({ message: "Email corporativo nao autorizado." });
      return;
    }

    const roleName = await decideUserRole(connection, email);
    const hash = await bcrypt.hash(password, 10);
    const [insertUser] = await connection.execute(
      "INSERT INTO users (corporate_email_id, email, password_hash, auth_provider, provider_subject, role_name) VALUES (?, ?, ?, 'local', NULL, ?)",
      [corporateEmailId, email, hash, roleName]
    );

    await writeAuditLog({
      connection,
      actorUserId: Number(insertUser.insertId),
      actorEmail: email,
      actionType: "auth.local.register",
      entityType: "user",
      entityId: String(insertUser.insertId),
      description: `Usuario ${email} criado com autenticacao local.`,
      metadata: { roleName }
    });

    await connection.commit();
    const user = { id: Number(insertUser.insertId), email, role: roleName };
    const token = signAuthToken(user);
    res.status(201).json({ token, user: { email: user.email, role: user.role } });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    console.error("AUTH_REGISTER_ERROR", error.code || "NO_CODE", error.message);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "Email ja cadastrado." });
      return;
    }
    if (error.message === "EMAIL_NOT_ALLOWED") {
      res.status(403).json({ message: "Email corporativo nao autorizado." });
      return;
    }
    if (error.message === "EMAIL_DISABLED") {
      res.status(403).json({ message: "Email corporativo desativado." });
      return;
    }
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(500).json({ message: "Banco sem schema aplicado. Rode o apply-schema e tente novamente." });
      return;
    }
    if (error.code === "ER_ACCESS_DENIED_ERROR") {
      res.status(500).json({ message: "Credenciais do banco invalidas. Verifique variaveis de ambiente." });
      return;
    }
    res.status(500).json({ message: "Erro interno ao cadastrar usuario." });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.options("/api/auth/login", cors());
app.post("/api/auth/login", async (req, res) => {
  if (GOOGLE_AUTH_ENABLED) {
    res.status(405).json({ message: "Use o login com Google." });
    return;
  }

  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    res.status(400).json({ message: "Email e senha sao obrigatorios." });
    return;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.password_hash, u.role_name, c.active
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

    await writeAuditLog({
      actorUserId: Number(user.id),
      actorEmail: user.email,
      actionType: "auth.local.login",
      entityType: "user",
      entityId: String(user.id),
      description: `Login local realizado por ${user.email}.`,
      metadata: { roleName: normalizeRole(user.role_name) }
    });

    const token = signAuthToken({ id: Number(user.id), email: user.email, role: normalizeRole(user.role_name) });
    res.json({ token, user: { email: user.email, role: normalizeRole(user.role_name) } });
  } catch (error) {
    console.error("AUTH_LOGIN_ERROR", error.code || "NO_CODE", error.message);
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(500).json({ message: "Banco sem schema aplicado. Rode o apply-schema e tente novamente." });
      return;
    }
    if (error.code === "ER_ACCESS_DENIED_ERROR") {
      res.status(500).json({ message: "Credenciais do banco invalidas. Verifique variaveis de ambiente." });
      return;
    }
    res.status(500).json({ message: "Erro interno ao autenticar." });
  }
});

app.options("/api/auth/google", cors());
app.post("/api/auth/google", async (req, res) => {
  if (!GOOGLE_AUTH_ENABLED || !googleClient) {
    res.status(503).json({ message: "Login com Google nao configurado." });
    return;
  }

  const credential = String(req.body?.credential || "").trim();
  if (!credential) {
    res.status(400).json({ message: "Credencial do Google ausente." });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = normalizeEmail(payload?.email);
    const providerSubject = String(payload?.sub || "").trim();

    if (!payload || !email || !providerSubject) {
      res.status(401).json({ message: "Token do Google invalido." });
      return;
    }
    if (!payload.email_verified) {
      res.status(403).json({ message: "Conta Google sem email verificado." });
      return;
    }
    const user = await upsertOAuthUser({
      email,
      provider: "google",
      providerSubject
    });

    const token = signAuthToken(user);
    res.json({ token, user: { email: user.email, role: user.role } });
  } catch (error) {
    console.error("AUTH_GOOGLE_ERROR", error.code || "NO_CODE", error.message);
    if (error.message === "EMAIL_NOT_ALLOWED") {
      res.status(403).json({ message: "Email corporativo nao autorizado." });
      return;
    }
    if (error.message === "EMAIL_DISABLED") {
      res.status(403).json({ message: "Email corporativo desativado." });
      return;
    }
    res.status(401).json({ message: "Falha ao autenticar com Google." });
  }
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  res.json({ user: { email: req.auth.email, role: req.auth.role } });
});

app.get("/api/users", authRequired, adminRequired, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.role_name, u.auth_provider, u.created_at, c.active
       FROM users u
       JOIN corporate_emails c ON c.id = u.corporate_email_id
       ORDER BY u.created_at DESC`
    );

    res.json({
      users: rows.map((row) => ({
        id: String(row.id),
        email: row.email,
        role: normalizeRole(row.role_name),
        authProvider: row.auth_provider || "local",
        active: !!row.active,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Falha ao listar usuarios." });
  }
});

app.put("/api/users/:id/role", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const roleName = normalizeRole(req.body?.role);

  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ message: "ID invalido." });
    return;
  }

  if (!["admin", "member"].includes(roleName)) {
    res.status(400).json({ message: "Papel invalido." });
    return;
  }

  try {
    const [rows] = await pool.execute(
      "SELECT id, email, role_name FROM users WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows.length) {
      res.status(404).json({ message: "Usuario nao encontrado." });
      return;
    }

    if (normalizeRole(rows[0].role_name) === "admin" && roleName === "member") {
      const [adminRows] = await pool.execute(
        "SELECT COUNT(*) AS total FROM users WHERE role_name = 'admin'"
      );
      if (Number(adminRows[0]?.total || 0) <= 1) {
        res.status(400).json({ message: "Nao e possivel remover o ultimo administrador." });
        return;
      }
    }

    await pool.execute("UPDATE users SET role_name = ? WHERE id = ?", [roleName, id]);
    await writeAuditLog({
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      actionType: "user.role.update",
      entityType: "user",
      entityId: String(id),
      description: `Papel do usuario ${rows[0].email} alterado para ${roleName}.`,
      metadata: {
        previousRole: normalizeRole(rows[0].role_name),
        nextRole: roleName
      }
    });

    res.json({
      user: {
        id: String(id),
        email: rows[0].email,
        role: roleName
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Falha ao atualizar permissao do usuario." });
  }
});

app.get("/api/audit-logs", authRequired, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, actor_user_id, actor_email, action_type, entity_type, entity_id, description, metadata_json, created_at
       FROM audit_logs
       ORDER BY created_at DESC, id DESC
       LIMIT 200`
    );

    res.json({
      logs: rows.map((row) => ({
        id: String(row.id),
        actorUserId: row.actor_user_id ? String(row.actor_user_id) : "",
        actorEmail: row.actor_email || "",
        actionType: row.action_type,
        entityType: row.entity_type,
        entityId: row.entity_id || "",
        description: row.description,
        metadata: row.metadata_json && typeof row.metadata_json === "string"
          ? JSON.parse(row.metadata_json)
          : (row.metadata_json || null),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Falha ao listar historico." });
  }
});

app.get("/api/computer-movements", authRequired, async (_req, res) => {
  try {
    const movements = await listComputerMovements();
    res.json({ movements });
  } catch (error) {
    res.status(500).json({ message: "Falha ao listar movimentacoes." });
  }
});

app.post("/api/computer-movements", authRequired, async (req, res) => {
  const computerId = Number(req.body?.computerId);
  const movementType = String(req.body?.movementType || "").trim().toLowerCase();
  const nextOwner = String(req.body?.nextOwner || "").trim();
  const nextCompany = String(req.body?.nextCompany || "").trim();
  const nextCorporateEmail = normalizeEmail(req.body?.nextCorporateEmail || "");
  const reason = String(req.body?.reason || "").trim();

  if (!Number.isFinite(computerId) || computerId <= 0) {
    res.status(400).json({ message: "Computador invalido." });
    return;
  }
  if (!["devolucao", "troca"].includes(movementType)) {
    res.status(400).json({ message: "Tipo de movimentacao invalido." });
    return;
  }
  if (movementType === "troca" && !nextOwner) {
    res.status(400).json({ message: "Informe o novo responsavel para a troca." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [computerRows] = await connection.execute(
      `SELECT c.id, c.owner_name, c.company_name, c.serial_number, c.machine_model, c.device_status, ce.email AS corporate_email
       FROM computers c
       LEFT JOIN corporate_emails ce ON ce.id = c.corporate_email_id
       WHERE c.id = ?
       LIMIT 1`,
      [computerId]
    );

    if (!computerRows.length) {
      await connection.rollback();
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    const computer = computerRows[0];
    const resolvedEmailId = movementType === "troca"
      ? await resolveCorporateEmailIdByEmail(connection, nextCorporateEmail)
      : null;
    const targetOwner = movementType === "devolucao" ? "Estoque" : nextOwner;
    const targetCompany = movementType === "devolucao" ? "" : nextCompany;
    const targetEmail = movementType === "devolucao" ? "" : nextCorporateEmail;
    const targetStatus = movementType === "devolucao" ? "pendente" : "ativo";

    await connection.execute(
      `UPDATE computers
       SET owner_name = ?, company_name = ?, corporate_email_id = ?, device_status = ?
       WHERE id = ?`,
      [targetOwner, targetCompany || null, resolvedEmailId, targetStatus, computerId]
    );

    const [movementInsert] = await connection.execute(
      `INSERT INTO computer_movements (
        computer_id,
        movement_type,
        previous_owner,
        previous_company_name,
        previous_corporate_email,
        previous_device_status,
        next_owner,
        next_company_name,
        next_corporate_email,
        next_device_status,
        reason,
        created_by_user_id,
        created_by_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        computerId,
        movementType,
        computer.owner_name || "",
        computer.company_name || "",
        computer.corporate_email || "",
        computer.device_status || "ativo",
        targetOwner,
        targetCompany || "",
        targetEmail,
        targetStatus,
        reason || null,
        req.auth.id,
        req.auth.email
      ]
    );

    await writeAuditLog({
      connection,
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      actionType: movementType === "devolucao" ? "computer.return" : "computer.exchange",
      entityType: "computer",
      entityId: String(computerId),
      description: movementType === "devolucao"
        ? `Computador ${computer.serial_number} devolvido para estoque.`
        : `Computador ${computer.serial_number} transferido para ${targetOwner}.`,
      metadata: {
        serial: computer.serial_number,
        previousOwner: computer.owner_name || "",
        previousCompany: computer.company_name || "",
        previousCorporateEmail: computer.corporate_email || "",
        previousDeviceStatus: computer.device_status || "ativo",
        nextOwner: targetOwner,
        nextCompany: targetCompany || "",
        nextCorporateEmail: targetEmail,
        nextDeviceStatus: targetStatus,
        reason
      }
    });

    await connection.commit();
    const movements = await listComputerMovements();
    const created = movements.find((item) => item.id === String(movementInsert.insertId));
    res.status(201).json({ movement: created || movements[0] || null });
  } catch (error) {
    await connection.rollback();
    if (error.message === "EMAIL_NOT_ALLOWED") {
      res.status(400).json({ message: "Email corporativo nao autorizado." });
      return;
    }
    res.status(500).json({ message: "Falha ao registrar movimentacao." });
  } finally {
    connection.release();
  }
});

app.delete("/api/computer-movements/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ message: "ID invalido." });
    return;
  }

  try {
    const movement = await getMovementById(pool, id);
    if (!movement) {
      res.status(404).json({ message: "Movimentacao nao encontrada." });
      return;
    }

    await pool.execute("DELETE FROM computer_movements WHERE id = ?", [id]);
    await writeAuditLog({
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      actionType: "computer-movement.delete",
      entityType: "computer-movement",
      entityId: String(id),
      description: `Movimentacao ${id} do computador ${movement.serial_number} removida do historico.`,
      metadata: {
        computerId: String(movement.computer_id),
        serial: movement.serial_number,
        movementType: movement.movement_type,
        previousCompany: movement.previous_company_name || "",
        nextCompany: movement.next_company_name || ""
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Falha ao excluir movimentacao." });
  }
});

app.post("/api/computer-movements/:id/revert", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ message: "ID invalido." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const movement = await getMovementById(connection, id);
    if (!movement) {
      await connection.rollback();
      res.status(404).json({ message: "Movimentacao nao encontrada." });
      return;
    }

    const latest = await isLatestMovementForComputer(connection, movement);
    if (!latest) {
      await connection.rollback();
      res.status(400).json({ message: "So e possivel reverter a ultima movimentacao deste computador." });
      return;
    }

    const previousCorporateEmailId = await resolveCorporateEmailIdByEmail(connection, movement.previous_corporate_email || "");
    await connection.execute(
      `UPDATE computers
       SET owner_name = ?, company_name = ?, corporate_email_id = ?, device_status = ?
       WHERE id = ?`,
      [
        movement.previous_owner || "",
        movement.previous_company_name || null,
        previousCorporateEmailId,
        movement.previous_device_status || "ativo",
        movement.computer_id
      ]
    );

    await connection.execute("DELETE FROM computer_movements WHERE id = ?", [id]);
    await writeAuditLog({
      connection,
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      actionType: "computer-movement.revert",
      entityType: "computer-movement",
      entityId: String(id),
      description: `Movimentacao ${id} do computador ${movement.serial_number} revertida.`,
      metadata: {
        computerId: String(movement.computer_id),
        serial: movement.serial_number,
        restoredOwner: movement.previous_owner || "",
        restoredCompany: movement.previous_company_name || "",
        restoredCorporateEmail: movement.previous_corporate_email || "",
        restoredDeviceStatus: movement.previous_device_status || "ativo"
      }
    });

    await connection.commit();
    const computer = await getComputerById(movement.computer_id);
    res.json({ success: true, computer });
  } catch (error) {
    await connection.rollback();
    if (error.message === "EMAIL_NOT_ALLOWED") {
      res.status(400).json({ message: "Nao foi possivel restaurar o email corporativo anterior." });
      return;
    }
    res.status(500).json({ message: "Falha ao reverter movimentacao." });
  } finally {
    connection.release();
  }
});

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
      await writeAuditLog({
        actorUserId: req.auth.id,
        actorEmail: req.auth.email,
        actionType: "corporate-email.restore",
        entityType: "corporate-email",
        entityId: String(existing[0].id),
        description: `Email corporativo ${email} reativado.`,
        metadata: { email }
      });
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
    await writeAuditLog({
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      actionType: "corporate-email.create",
      entityType: "corporate-email",
      entityId: String(insert.insertId),
      description: `Email corporativo ${email} criado.`,
      metadata: { email }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "Este email ja foi cadastrado." });
      return;
    }
    res.status(500).json({ message: "Falha ao adicionar email corporativo." });
  }
});

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
    await writeAuditLog({
      connection,
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      actionType: "corporate-email.delete",
      entityType: "corporate-email",
      entityId: String(id),
      description: `Email corporativo ${rows[0].email} removido.`,
      metadata: { email: rows[0].email }
    });
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Falha ao remover email corporativo." });
  } finally {
    connection.release();
  }
});

function normalizeComputerPayload(body = {}) {
  const payload = {
    owner: String(body.owner || "").trim(),
    company: String(body.company || "").trim(),
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

app.post("/api/computers", authRequired, async (req, res) => {
  const payload = normalizeComputerPayload(req.body || {});

  if (!payload.owner || !payload.serial) {
    res.status(400).json({ message: "Dono e numero de serie sao obrigatorios." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    const corporateEmailId = await resolveCorporateEmailIdByEmail(connection, payload.corporateEmail);

    const [insert] = await connection.execute(
      `INSERT INTO computers (
        owner_name,
        company_name,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.owner,
        payload.company || null,
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

    const created = await getComputerById(insert.insertId);
    await writeAuditLog({
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      actionType: "computer.create",
      entityType: "computer",
      entityId: String(insert.insertId),
      description: `Computador ${payload.serial} criado.`,
      metadata: { serial: payload.serial, owner: payload.owner, company: payload.company || "" }
    });
    res.status(201).json({ computer: created });
  } catch (error) {
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
    const corporateEmailId = await resolveCorporateEmailIdByEmail(connection, payload.corporateEmail);

    const [updateResult] = await connection.execute(
      `UPDATE computers
       SET owner_name = ?,
           company_name = ?,
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
        payload.company || null,
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
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    const updated = await getComputerById(id);
    await writeAuditLog({
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      actionType: "computer.update",
      entityType: "computer",
      entityId: String(id),
      description: `Computador ${payload.serial} atualizado.`,
      metadata: { serial: payload.serial, owner: payload.owner, company: payload.company || "" }
    });
    res.json({ computer: updated });
  } catch (error) {
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

app.delete("/api/computers/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ message: "ID invalido." });
    return;
  }

  try {
    const [existingRows] = await pool.execute(
      "SELECT serial_number, owner_name, company_name FROM computers WHERE id = ? LIMIT 1",
      [id]
    );
    if (!existingRows.length) {
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    const [result] = await pool.execute("DELETE FROM computers WHERE id = ?", [id]);
    await writeAuditLog({
      actorUserId: req.auth.id,
      actorEmail: req.auth.email,
      actionType: "computer.delete",
      entityType: "computer",
      entityId: String(id),
      description: `Computador ${existingRows[0].serial_number} removido.`,
      metadata: {
        serial: existingRows[0].serial_number,
        owner: existingRows[0].owner_name,
        company: existingRows[0].company_name || ""
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Falha ao remover computador." });
  }
});

// Em deploy (Render), o mesmo serviço pode responder o frontend estatico.
app.use(express.static(__dirname));
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((err, _req, res, _next) => {
  if (err && err.message && String(err.message).includes("CORS")) {
    res.status(403).json({ message: err.message });
    return;
  }
  res.status(500).json({ message: "Erro interno inesperado." });
});

applySchemaOnStartup()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("DB_SCHEMA_STARTUP_ERROR", error.code || "NO_CODE", error.message);
    process.exit(1);
  });
