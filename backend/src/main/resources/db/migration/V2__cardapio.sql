CREATE TABLE produto (
 id CHAR(36) PRIMARY KEY, nome VARCHAR(120) NOT NULL, descricao TEXT NULL, categoria VARCHAR(30) NOT NULL,
 preco DECIMAL(10,2) NOT NULL, imagem_url VARCHAR(1000) NULL, estacao VARCHAR(20) NOT NULL,
 tempo_preparo_estimado_min INT NOT NULL, disponivel BOOLEAN NOT NULL DEFAULT TRUE, ativo BOOLEAN NOT NULL DEFAULT TRUE,
 version BIGINT NOT NULL DEFAULT 0, CONSTRAINT ck_produto_preco CHECK (preco >= 0)
);
CREATE TABLE adicional (
 id CHAR(36) PRIMARY KEY, nome VARCHAR(120) NOT NULL, preco DECIMAL(10,2) NOT NULL,
 ativo BOOLEAN NOT NULL DEFAULT TRUE, CONSTRAINT uk_adicional_nome UNIQUE(nome),
 CONSTRAINT ck_adicional_preco CHECK (preco >= 0)
);
CREATE TABLE adicional_categoria (
 adicional_id CHAR(36) NOT NULL, categoria VARCHAR(30) NOT NULL,
 PRIMARY KEY (adicional_id,categoria), CONSTRAINT fk_ac_adicional FOREIGN KEY (adicional_id) REFERENCES adicional(id),
 CONSTRAINT ck_ac_categoria CHECK (categoria NOT IN ('PRATOS_PRINCIPAIS','BEBIDAS'))
);
