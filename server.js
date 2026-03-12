const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.API_PORT || process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const DB_SSL = String(process.env.DB_SSL || "true").toLowerCase() === "true";
const CORPORATE_EMAIL_DOMAIN = String(process.env.CORPORATE_EMAIL_DOMAIN || "okta7.com.br")
  .trim()
  .toLowerCase();
const AUTH_REQUIRE_PREAUTHORIZED_EMAIL = String(process.env.AUTH_REQUIRE_PREAUTHORIZED_EMAIL || "false").toLowerCase() === "true";

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
const corsOptions = { origin: buildCorsOrigin(), credentials: true };
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());

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

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "API online" });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Falha na conexao com banco." });
  }
});

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

async function findUserForLogin(email) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.password_hash, c.active
       FROM users u
       JOIN corporate_emails c ON c.id = u.corporate_email_id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    if (!rows.length) return null;
    return {
      id: Number(rows[0].id),
      email: rows[0].email,
      passwordHash: rows[0].password_hash,
      active: Boolean(rows[0].active)
    };
  } catch (error) {
    if (!["ER_BAD_FIELD_ERROR", "ER_NO_SUCH_TABLE"].includes(error.code)) {
      throw error;
    }

    const [legacyRows] = await pool.execute(
      `SELECT id, email, password AS password_hash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (!legacyRows.length) return null;
    return {
      id: Number(legacyRows[0].id),
      email: legacyRows[0].email,
      passwordHash: legacyRows[0].password_hash,
      active: true
    };
  }
}

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    res.status(400).json({ message: "Email e senha sao obrigatorios." });
    return;
  }

  try {
    const user = await findUserForLogin(email);

    if (!user) {
      res.status(401).json({ message: "Credenciais invalidas." });
      return;
    }

    if (!user.active) {
      res.status(403).json({ message: "Email corporativo desativado." });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ message: "Credenciais invalidas." });
      return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ message: "Credenciais invalidas." });
      return;
    }

    const token = signAuthToken({ id: user.id, email: user.email });
    res.json({ token, user: { email: user.email } });
  } catch (error) {
    res.status(500).json({ message: "Erro interno ao autenticar." });
  }
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  res.json({ user: { email: req.auth.email } });
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

function normalizeComputerPayload(body = {}) {
  const parsedWarrantyMonths = Number(body.warrantyMonths);
  const warrantyMonths = Number.isFinite(parsedWarrantyMonths) && parsedWarrantyMonths > 0
    ? Math.floor(parsedWarrantyMonths)
    : 0;

  const payload = {
    owner: String(body.owner || "").trim(),
    serial: String(body.serial || "").trim(),
    machine: String(body.machine || "").trim(),
    deviceStatus: String(body.deviceStatus || "ativo").trim().toLowerCase(),
    corporateEmail: normalizeEmail(body.corporateEmail || ""),
    purchaseDate: String(body.purchaseDate || "").trim(),
    warrantyMonths,
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

  payload.warrantyDays = payload.warrantyMonths > 0 ? Math.round(payload.warrantyMonths * 30) : 0;

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

    const created = await getComputerById(insert.insertId);
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
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }

    const updated = await getComputerById(id);
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
    const [result] = await pool.execute("DELETE FROM computers WHERE id = ?", [id]);
    if (!result.affectedRows) {
      res.status(404).json({ message: "Computador nao encontrado." });
      return;
    }
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

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
