CREATE TABLE configuracao_couvert (
 id TINYINT PRIMARY KEY,
 valor DECIMAL(10,2) NOT NULL,
 CONSTRAINT ck_configuracao_couvert_valor CHECK (valor >= 0)
);
INSERT INTO configuracao_couvert(id, valor) VALUES (1, 0.00);
UPDATE usuario SET papel='GARCOM' WHERE papel='CAIXA';
