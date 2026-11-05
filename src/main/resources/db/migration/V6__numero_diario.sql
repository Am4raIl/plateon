ALTER TABLE pedido ADD CONSTRAINT uk_pedido_dia_numero UNIQUE(dia_operacional, numero_diario);
