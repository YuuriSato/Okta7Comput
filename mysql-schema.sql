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
  role_name VARCHAR(32) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT fk_users_corporate_email
    FOREIGN KEY (corporate_email_id) REFERENCES corporate_emails (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_email VARCHAR(255) NULL,
  action_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120) NULL,
  description TEXT NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_logs_created_at (created_at),
  KEY idx_audit_logs_actor_user_id (actor_user_id),
  CONSTRAINT fk_audit_logs_actor_user
    FOREIGN KEY (actor_user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS computer_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  computer_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('devolucao','troca') NOT NULL,
  previous_owner VARCHAR(120) NULL,
  previous_corporate_email VARCHAR(255) NULL,
  previous_device_status ENUM('ativo','inativo','pendente') NOT NULL DEFAULT 'ativo',
  next_owner VARCHAR(120) NULL,
  next_corporate_email VARCHAR(255) NULL,
  next_device_status ENUM('ativo','inativo','pendente') NOT NULL DEFAULT 'ativo',
  reason TEXT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_by_email VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_computer_movements_created_at (created_at),
  KEY idx_computer_movements_computer_id (computer_id),
  CONSTRAINT fk_computer_movements_computer
    FOREIGN KEY (computer_id) REFERENCES computers (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_computer_movements_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
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
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role_name'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN role_name VARCHAR(32) NOT NULL DEFAULT ''member''', 'SELECT 1');
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

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computer_movements'
);
SET @sql := IF(@exists = 0,
  'CREATE TABLE computer_movements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    computer_id BIGINT UNSIGNED NOT NULL,
    movement_type ENUM(''devolucao'',''troca'') NOT NULL,
    previous_owner VARCHAR(120) NULL,
    previous_corporate_email VARCHAR(255) NULL,
    previous_device_status ENUM(''ativo'',''inativo'',''pendente'') NOT NULL DEFAULT ''ativo'',
    next_owner VARCHAR(120) NULL,
    next_corporate_email VARCHAR(255) NULL,
    next_device_status ENUM(''ativo'',''inativo'',''pendente'') NOT NULL DEFAULT ''ativo'',
    reason TEXT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_by_email VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_computer_movements_created_at (created_at),
    KEY idx_computer_movements_computer_id (computer_id),
    CONSTRAINT fk_computer_movements_computer FOREIGN KEY (computer_id) REFERENCES computers (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_computer_movements_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL
  )',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computer_movements' AND COLUMN_NAME = 'previous_device_status'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computer_movements ADD COLUMN previous_device_status ENUM(''ativo'',''inativo'',''pendente'') NOT NULL DEFAULT ''ativo'' AFTER previous_corporate_email', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'computer_movements' AND COLUMN_NAME = 'next_device_status'
);
SET @sql := IF(@exists = 0, 'ALTER TABLE computer_movements ADD COLUMN next_device_status ENUM(''ativo'',''inativo'',''pendente'') NOT NULL DEFAULT ''ativo'' AFTER next_corporate_email', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Seed opcional:
-- INSERT INTO corporate_emails (email, active) VALUES
-- ('admin@okta7.com.br', 1);

