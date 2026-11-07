CREATE TABLE pedido_status_historico (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, pedido_id CHAR(36) NOT NULL, de VARCHAR(20) NULL,
 para VARCHAR(20) NOT NULL, em DATETIME(6) NOT NULL, usuario_id CHAR(36) NULL, motivo VARCHAR(500) NULL,
 CONSTRAINT fk_hist_pedido FOREIGN KEY (pedido_id) REFERENCES pedido(id),
 CONSTRAINT fk_hist_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id),
 INDEX ix_hist_pedido_em (pedido_id,em)
);
