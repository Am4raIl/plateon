CREATE TABLE mesa (
 id CHAR(36) PRIMARY KEY, numero INT NOT NULL, capacidade INT NOT NULL, ativa BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT uk_mesa_numero UNIQUE(numero), CONSTRAINT ck_mesa_capacidade CHECK (capacidade >= 1)
);
CREATE TABLE usuario (
 id CHAR(36) PRIMARY KEY, nome VARCHAR(120) NOT NULL, username VARCHAR(80) NOT NULL,
 senha_hash VARCHAR(100) NOT NULL, papel VARCHAR(20) NOT NULL, ativo BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT uk_usuario_username UNIQUE(username)
);
