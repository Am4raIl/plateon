CREATE TABLE pagamento (
 id CHAR(36) PRIMARY KEY, comanda_id CHAR(36) NOT NULL, forma VARCHAR(20) NOT NULL,
 valor DECIMAL(10,2) NOT NULL, registrado_em DATETIME(6) NOT NULL, registrado_por CHAR(36) NOT NULL,
 CONSTRAINT fk_pag_comanda FOREIGN KEY (comanda_id) REFERENCES comanda(id),
 CONSTRAINT fk_pag_usuario FOREIGN KEY (registrado_por) REFERENCES usuario(id),
 CONSTRAINT ck_pag_valor CHECK (valor > 0)
);
