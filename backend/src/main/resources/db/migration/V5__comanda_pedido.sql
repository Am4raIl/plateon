CREATE TABLE comanda (
 id CHAR(36) PRIMARY KEY, mesa_id CHAR(36) NOT NULL, status VARCHAR(30) NOT NULL,
 aberta_em DATETIME(6) NOT NULL, fechada_em DATETIME(6) NULL,
 taxa_servico_percentual DECIMAL(5,2) NOT NULL, couvert DECIMAL(10,2) NOT NULL,
 mesa_aberta_id CHAR(36) GENERATED ALWAYS AS (IF(status = 'ABERTA', mesa_id, NULL)) STORED,
 CONSTRAINT fk_comanda_mesa FOREIGN KEY (mesa_id) REFERENCES mesa(id),
 CONSTRAINT ux_comanda_aberta_por_mesa UNIQUE(mesa_aberta_id)
);
CREATE TABLE pedido (
 id CHAR(36) PRIMARY KEY, comanda_id CHAR(36) NOT NULL, status VARCHAR(20) NOT NULL,
 numero_diario INT NULL, dia_operacional DATE NULL, observacao_geral TEXT NULL,
 criado_em DATETIME(6) NOT NULL, atualizado_em DATETIME(6) NOT NULL, enviado_em DATETIME(6) NULL,
 version BIGINT NOT NULL DEFAULT 0,
 comanda_rascunho_id CHAR(36) GENERATED ALWAYS AS (IF(status = 'RASCUNHO', comanda_id, NULL)) STORED,
 CONSTRAINT fk_pedido_comanda FOREIGN KEY (comanda_id) REFERENCES comanda(id),
 CONSTRAINT ux_pedido_rascunho_por_comanda UNIQUE(comanda_rascunho_id),
 INDEX ix_pedido_status_enviado (status,enviado_em), INDEX ix_pedido_dia (dia_operacional)
);
CREATE TABLE item_pedido (
 id CHAR(36) PRIMARY KEY, pedido_id CHAR(36) NOT NULL, produto_id CHAR(36) NOT NULL,
 quantidade INT NOT NULL, observacao VARCHAR(200) NULL, nome_produto VARCHAR(120) NOT NULL,
 preco_unitario DECIMAL(10,2) NOT NULL, estacao VARCHAR(20) NOT NULL,
 CONSTRAINT fk_item_pedido FOREIGN KEY (pedido_id) REFERENCES pedido(id),
 CONSTRAINT fk_item_produto FOREIGN KEY (produto_id) REFERENCES produto(id),
 CONSTRAINT ck_item_quantidade CHECK (quantidade >= 1), CONSTRAINT ck_item_preco CHECK (preco_unitario >= 0)
);
CREATE TABLE item_adicional (
 id CHAR(36) PRIMARY KEY, item_pedido_id CHAR(36) NOT NULL, adicional_id CHAR(36) NOT NULL,
 nome VARCHAR(120) NOT NULL, preco DECIMAL(10,2) NOT NULL,
 CONSTRAINT fk_ia_item FOREIGN KEY (item_pedido_id) REFERENCES item_pedido(id) ON DELETE CASCADE,
 CONSTRAINT fk_ia_adicional FOREIGN KEY (adicional_id) REFERENCES adicional(id),
 CONSTRAINT uk_ia_item_adicional UNIQUE(item_pedido_id,adicional_id),
 CONSTRAINT ck_ia_preco CHECK (preco >= 0)
);
CREATE TABLE chamado_garcom (
 id CHAR(36) PRIMARY KEY, mesa_id CHAR(36) NOT NULL, tipo VARCHAR(20) NOT NULL,
 status VARCHAR(20) NOT NULL, criado_em DATETIME(6) NOT NULL, atendido_em DATETIME(6) NULL,
 atendido_por CHAR(36) NULL, CONSTRAINT fk_chamado_mesa FOREIGN KEY (mesa_id) REFERENCES mesa(id),
 CONSTRAINT fk_chamado_usuario FOREIGN KEY (atendido_por) REFERENCES usuario(id)
);
