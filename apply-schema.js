const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
// Usa .env local para parametros de conexao.
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function run() {
  // Valida variaveis obrigatorias antes de tocar no banco.
  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASS"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Variaveis ausentes no .env: ${missing.join(", ")}`);
  }

  // Le o arquivo SQL com DDL/DML do schema.
  const schemaPath = path.join(__dirname, "mysql-schema.sql");
  if (!fs.existsSync(schemaPath)) {
    throw new Error("Arquivo mysql-schema.sql nao encontrado em /work.");
  }

  const sql = fs.readFileSync(schemaPath, "utf8");
  const useSsl = String(process.env.DB_SSL || "true").toLowerCase() === "true";

  // Conexao unica para aplicar o schema completo de uma vez.
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
    // Garante fechamento da conexao mesmo em caso de erro.
    await connection.end();
  }
}

// Encerra com codigo 1 para facilitar CI/CD e troubleshooting.
run().catch((error) => {
  console.error("Falha ao aplicar schema:", error.message);
  process.exit(1);
});
