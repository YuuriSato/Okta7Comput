const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function run() {
  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASS"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Variaveis ausentes no .env: ${missing.join(", ")}`);
  }

  const schemaPath = path.join(__dirname, "mysql-schema.sql");
  if (!fs.existsSync(schemaPath)) {
    throw new Error("Arquivo mysql-schema.sql nao encontrado em /work.");
  }

  const sql = fs.readFileSync(schemaPath, "utf8");
  const useSsl = String(process.env.DB_SSL || "true").toLowerCase() === "true";

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true
  });

  try {
    await connection.query(sql);
    console.log("Schema aplicado com sucesso.");
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Falha ao aplicar schema:", error.message);
  process.exit(1);
});
