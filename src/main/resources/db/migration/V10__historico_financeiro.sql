ALTER TABLE item_pedido ADD COLUMN categoria VARCHAR(30) NULL;
UPDATE item_pedido i JOIN produto p ON p.id=i.produto_id SET i.categoria=p.categoria;
ALTER TABLE item_pedido MODIFY categoria VARCHAR(30) NOT NULL;

ALTER TABLE comanda
 ADD COLUMN subtotal_fechamento DECIMAL(18,2) NULL,
 ADD COLUMN taxa_fechamento DECIMAL(18,2) NULL,
 ADD COLUMN total_fechamento DECIMAL(18,2) NULL;

-- Dados anteriores só permitem reconstruir o fechamento a partir dos itens atuais.
UPDATE comanda c
LEFT JOIN (
 SELECT p.comanda_id,
 SUM((i.preco_unitario + COALESCE(a.preco,0))*i.quantidade) AS subtotal
 FROM pedido p JOIN item_pedido i ON i.pedido_id=p.id
 LEFT JOIN (SELECT item_pedido_id,SUM(preco) AS preco FROM item_adicional GROUP BY item_pedido_id) a ON a.item_pedido_id=i.id
 WHERE p.status NOT IN ('RASCUNHO','CANCELADO') GROUP BY p.comanda_id
) v ON v.comanda_id=c.id
SET c.subtotal_fechamento=COALESCE(v.subtotal,0),
 c.taxa_fechamento=ROUND(COALESCE(v.subtotal,0)*c.taxa_servico_percentual/100,2),
 c.total_fechamento=COALESCE(v.subtotal,0)+ROUND(COALESCE(v.subtotal,0)*c.taxa_servico_percentual/100,2)+c.couvert
WHERE c.status='PAGA';
