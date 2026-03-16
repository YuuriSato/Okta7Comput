-- Schema principal para Inventario com auth e email corporativo
-- Compatível com MySQL 8+

CREATE TABLE IF NOT EXISTS corporate_emails (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_corporate_emails_email (email)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  corporate_email_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  auth_provider VARCHAR(32) NOT NULL DEFAULT 'local',
  provider_subject VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT fk_users_corporate_email
    FOREIGN KEY (corporate_email_id) REFERENCES corporate_emails (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS computers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_name VARCHAR(120) NOT NULL,
  serial_number VARCHAR(120) NOT NULL,
  machine_model VARCHAR(120) NULL,
  device_status ENUM('ativo','inativo','pendente') NOT NULL DEFAULT 'ativo',
  purchase_date DATE NULL,
  warranty_months INT UNSIGNED NOT NULL DEFAULT 0,
  warranty_days INT UNSIGNED NOT NULL DEFAULT 0,
  cpu VARCHAR(255) NULL,
  ram VARCHAR(255) NULL,
  gpu VARCHAR(255) NULL,
  storage VARCHAR(120) NULL,
  storage_type VARCHAR(40) NULL,
  operating_system VARCHAR(120) NULL,
  notes TEXT NULL,
  specs TEXT NOT NULL,
  corporate_email_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_computers_serial_number (serial_number),
  KEY idx_computers_corporate_email (corporate_email_id),
  CONSTRAINT fk_computers_corporate_email
    FOREIGN KEY (corporate_email_id) REFERENCES corporate_emails (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- Compatibilidade para bancos que ja tinham a versao antiga da tabela computers.
-- (sem usar IF NOT EXISTS no ALTER, para compatibilidade ampla)

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'auth_provider'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN auth_provider VARCHAR(32) NOT NULL DEFAULT ''local''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'provider_subject'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN provider_subject VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'owner_name'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN owner_name VARCHAR(120) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'device_status'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN device_status ENUM(''ativo'',''inativo'',''pendente'') NOT NULL DEFAULT ''ativo''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'purchase_date'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN purchase_date DATE NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'warranty_months'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN warranty_months INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'warranty_days'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN warranty_days INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'cpu'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN cpu VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'ram'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN ram VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'gpu'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN gpu VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'storage'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN storage VARCHAR(120) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'storage_type'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN storage_type VARCHAR(40) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'operating_system'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN operating_system VARCHAR(120) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'notes'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN notes TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'specs'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN specs TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computers' AND COLUMN_NAME = 'corporate_email_id'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computers ADD COLUMN corporate_email_id BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Seed opcional:
-- INSERT INTO corporate_emails (email, active) VALUES
-- ('admin@okta7.com.br', 1);

