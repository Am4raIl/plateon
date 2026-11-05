CREATE TABLE dispositivo (
 id CHAR(36) PRIMARY KEY, mesa_id CHAR(36) NOT NULL, nome VARCHAR(120) NOT NULL,
 token_hash CHAR(64) NOT NULL, ativo BOOLEAN NOT NULL DEFAULT TRUE, pareado_em DATETIME(6) NOT NULL,
 ultimo_acesso_em DATETIME(6) NULL, revogado_em DATETIME(6) NULL,
 mesa_ativa_id CHAR(36) GENERATED ALWAYS AS (IF(ativo = 1, mesa_id, NULL)) STORED,
 CONSTRAINT fk_dispositivo_mesa FOREIGN KEY (mesa_id) REFERENCES mesa(id),
 CONSTRAINT ux_dispositivo_ativo_por_mesa UNIQUE(mesa_ativa_id), CONSTRAINT uk_dispositivo_token_hash UNIQUE(token_hash)
);
CREATE TABLE solicitacao_pareamento (
 id CHAR(36) PRIMARY KEY, codigo CHAR(6) NOT NULL, status VARCHAR(20) NOT NULL,
 criada_em DATETIME(6) NOT NULL, expira_em DATETIME(6) NOT NULL, dispositivo_id CHAR(36) NULL,
 CONSTRAINT fk_sp_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivo(id),
 CONSTRAINT uk_sp_codigo UNIQUE(codigo)
);
