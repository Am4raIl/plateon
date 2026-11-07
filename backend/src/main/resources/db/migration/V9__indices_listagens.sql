CREATE INDEX ix_comanda_status_abertura ON comanda(status, aberta_em, id);
CREATE INDEX ix_chamado_criacao ON chamado_garcom(criado_em, id);
CREATE INDEX ix_chamado_status_criacao ON chamado_garcom(status, criado_em, id);
CREATE INDEX ix_produto_categoria_nome ON produto(categoria, nome, id);
CREATE INDEX ix_usuario_nome ON usuario(nome, id);
