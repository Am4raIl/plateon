ALTER TABLE comanda ADD COLUMN atualizada_em DATETIME(6) NULL;
UPDATE comanda SET atualizada_em=COALESCE(fechada_em,aberta_em);

CREATE TABLE comanda_reabertura (
 id CHAR(36) PRIMARY KEY, comanda_id CHAR(36) NOT NULL,
 reaberta_em DATETIME(6) NOT NULL, reaberta_por CHAR(36) NOT NULL,
 motivo VARCHAR(500) NOT NULL, total_anterior DECIMAL(10,2) NOT NULL,
 CONSTRAINT fk_reabertura_comanda FOREIGN KEY (comanda_id) REFERENCES comanda(id),
 CONSTRAINT fk_reabertura_usuario FOREIGN KEY (reaberta_por) REFERENCES usuario(id)
);
CREATE TABLE pagamento_estornado (
 id CHAR(36) PRIMARY KEY, reabertura_id CHAR(36) NOT NULL,
 pagamento_id CHAR(36) NOT NULL, forma VARCHAR(20) NOT NULL,
 valor DECIMAL(10,2) NOT NULL, registrado_em DATETIME(6) NOT NULL,
 registrado_por CHAR(36) NOT NULL,
 CONSTRAINT fk_pagamento_estornado_reabertura FOREIGN KEY (reabertura_id) REFERENCES comanda_reabertura(id)
);
