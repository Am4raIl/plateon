# Coleção Plateon para Bruno

Esta coleção usa o formato YAML/OpenCollection do Bruno. Ela contém exemplos para as rotas públicas, do tablet e da equipe; o catálogo completo da API está em [docs.md](../docs/docs.md). Os tokens e IDs obtidos pelas respostas ficam em variáveis de execução do Bruno; não são gravados nos arquivos da coleção.

## Preparação

1. Inicie o Plateon com MySQL e um usuário gerente, conforme o `README.md` da raiz.
2. Copie `environments/Local.example.yml` para `environments/Local.yml` e troque `admin_password` pela senha definida em `ADMIN_PASSWORD`. O arquivo `Local.yml` é ignorado pelo Git. Não salve valores reais em `Local.example.yml` nem em requisições versionadas.
3. Abra a pasta `bruno` como coleção no Bruno e selecione o ambiente `Local`.

## Teste do fluxo principal

Envie as requisições nesta ordem:

1. `Autenticacao/POST Login` guarda o JWT da equipe.
2. `Mesas/GET Mesas` escolhe a primeira mesa e guarda `mesa_id`.
3. `Pareamento/POST Solicitar codigo`, `POST Aprovar codigo` e `GET Token do tablet` guardam o token da mesa. Se a mesa já tiver um tablet ativo, revogue-o antes ou escolha outra mesa.
4. `Tablet/GET Cardapio`, `POST Criar pedido`, `POST Adicionar item` e `POST Enviar pedido` guardam produto, pedido e versão.
5. `Kanban/PATCH EM_PREPARO`, `PATCH PRONTO` e `PATCH ENTREGUE` avançam o pedido.
6. `Tablet/GET Comanda atual` guarda o total; `Comandas/POST Fechar comanda PIX` fecha a conta.
7. Após o pagamento, o backend revoga o tablet. `Tablet/GET Estado` com o token antigo deve devolver `401`; para continuar, faça um novo pareamento. Um tablet recém-pareado à mesa, sem comanda ativa, recebe `LIVRE`.

As demais requisições são exemplos independentes de administração e de caminhos alternativos. `PATCH Alterar item` e `DELETE Remover item` exigem pedido em rascunho; `POST Cancelar pedido` substitui o avanço no Kanban. Os pedidos SSE permanecem abertos enquanto houver eventos; pare a requisição manualmente no Bruno.

Nos exemplos de criação, altere `numero` da mesa e `username` do usuário se repetir a operação. Para trocar o endereço da API, ajuste `base_url` no ambiente `Local`.
