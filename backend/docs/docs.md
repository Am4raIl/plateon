# Plateon: guia de integração para o frontend

Este documento descreve a API **implementada** no backend Plateon. Seu público é quem integra as interfaces do tablet fixo da mesa e da equipe do restaurante. Em caso de diferença, confira o código e o OpenAPI da versão em execução.

## 1. Produto e telas esperadas

Plateon atende um restaurante de salão. Cada mesa tem um tablet próprio: o cliente vê o cardápio, monta e envia pedidos, acompanha o andamento, consulta a conta e chama um garçom. Não há QR code, celular do cliente, pagamento eletrônico real, impressão, estoque ou divisão de conta. Cozinha e bar acompanham pedidos em um Kanban. O garçom atende chamados, pareia tablets e fecha comandas. O gerente administra cardápio, mesas, usuários, couvert, dispositivos e indicadores.

Uma implementação de frontend pode ter estas áreas:

| Área | Telas/ações principais | Autenticação |
| --- | --- | --- |
| Tablet da mesa | Pareamento por código, estado da mesa, cardápio, carrinho/rascunho, pedidos enviados, acompanhamento, comanda e chamado | Token do dispositivo |
| Equipe | Login, Kanban, chamados, comandas e pagamento | JWT do funcionário |
| Gerência | Produtos, adicionais, mesas, usuários, dispositivos e dashboard | JWT de gerente |

O backend não serve interface gráfica. O frontend do repositório encaminha `/api/v1` pelo Next.js, sem exigir CORS entre navegador e API. Se outro frontend chamar a API diretamente de uma origem diferente, configure `CORS_ORIGINS` com essa origem exata.

## 2. Convenções da API

- URL local: **http://localhost:8081/api/v1**. Swagger: http://localhost:8081/swagger-ui.html. OpenAPI: http://localhost:8081/v3/api-docs.
- Envie JSON com Content-Type: application/json. Campos extras em corpos JSON são rejeitados com 400. Os nomes dos campos usam camelCase e os valores de enums usam letras maiúsculas.
- IDs são UUIDs como string. Nunca derive o número da mesa a partir de um UUID.
- Valores monetários são números JSON em reais, com até duas casas decimais. Mostre-os em BRL. Use o total devolvido pela API no fechamento; preços e taxas são calculados pelo servidor.
- Instantes são strings ISO 8601 em UTC, por exemplo 2026-11-04T19:00:00Z. O dia operacional usa America/Sao_Paulo e começa às **04:00**: às 02:00 ainda vale a data anterior.
- O sucesso das rotas atuais usa HTTP 200. DELETE e alguns PATCH de ação devolvem 200 com corpo vazio. Listas podem ser vazias.
- As listas administrativas de comandas, chamados, produtos e usuários são paginadas. Use `pagina` a partir de 0 e `tamanho` de 1 a 100 (padrão 20); valores fora do intervalo retornam 400. As demais listas continuam arrays. Consulte os filtros de cada rota abaixo.
- A API usa um único backend/instância para eventos SSE em memória. Faça uma leitura HTTP inicial e atualize os dados após cada evento ou reconexão.

### Autenticação e papéis

Há **dois Bearer diferentes** no cabeçalho Authorization:

~~~http
Authorization: Bearer <jwt-da-equipe>
Authorization: Bearer <token-do-tablet>
~~~

O JWT da equipe vem de POST /auth/login, dura 8 horas e só funciona em /admin/**. Não há refresh token ou logout no servidor: ao sair, descarte o JWT; quando expirar, faça login novamente. O token do tablet é obtido uma única vez durante o pareamento, deve ser guardado de forma persistente nesse tablet e só funciona em /mesa/**. O servidor consulta o banco em cada chamada; revogação ou mudança de mesa tem efeito imediato. A mesa é resolvida pelo token, portanto o frontend do tablet **nunca** envia mesaId ou numeroMesa.

| Recurso | Papéis aceitos |
| --- | --- |
| Ver e mover Kanban | COZINHA, GARCOM, GERENTE |
| Ver/atender chamados e aprovar pareamento | GARCOM, GERENTE |
| Ver comandas | GARCOM, GERENTE |
| Abrir comanda pelo painel | GARCOM, GERENTE |
| Fechar comanda e registrar pagamento | GARCOM, GERENTE |
| Produtos, adicionais, mesas, usuários, couvert e dashboard | GERENTE |
| Listar mesas e tablets, parear e desparear tablet | GARCOM, GERENTE |
| Editar dados do tablet | GERENTE |

A hierarquia configurada é GERENTE acima de GARCOM, e GARCOM acima de COZINHA. Use o campo papel do login para mostrar menus adequados, mas trate 403 da API como autoridade final.

### Erros

Erros de validação e negócio retornam application/problem+json, geralmente com type, title, status e detail. Erros de autenticação e rate limit podem trazer apenas status e detail. Exemplo de conflito de versão:

~~~json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "Versão desatualizada",
  "estadoAtual": "EM_PREPARO",
  "transicoesPermitidas": ["PRONTO", "CANCELADO"]
}
~~~

| Código | O que a UI deve fazer |
| --- | --- |
| 400 | Mostrar erro de corpo/campo; não reenviar campos desconhecidos. |
| 401 | Equipe: pedir novo login. Tablet: refazer pareamento se o token foi revogado/inválido. |
| 403 | Esconder ou bloquear a ação para esse papel. |
| 404 | Item inexistente ou pedido de outra mesa; não exibir dados de outra mesa. |
| 409 | Recarregar o recurso e seu estado/versao antes de oferecer nova ação. |
| 410 | Código expirado ou token de pareamento já entregue; criar nova solicitação se necessário. |
| 422 | Corrigir regra de negócio, como produto indisponível, adicional inválido, motivo ausente ou soma de pagamentos. |
| 429 | Aguardar os segundos indicados no header Retry-After. Login e criação de pareamento têm cotas independentes de 10/minuto por IP; polling tem 60/minuto por IP e solicitação e teto agregado de 600/minuto por IP. |
| 500 | Exibir falha genérica e permitir nova tentativa. |

## 3. Formatos de resposta reutilizados

Os exemplos das Views seguintes mostram **todos os campos** de cada formato. IDs e datas são ilustrativos. Um campo opcional pode ser null. Listas sem paginação usam arrays desses objetos.

As listas administrativas paginadas devolvem um objeto com este formato (o exemplo usa produtos):

~~~json
{
  "itens": [{"id":"11111111-1111-4111-8111-111111111111","nome":"X-Burger"}],
  "pagina": 0,
  "tamanho": 20,
  "totalItens": 43,
  "totalPaginas": 3,
  "temProxima": true
}
~~~

Cada item real contém todos os campos de sua View, descritos neste guia. Uma página além do fim devolve `itens: []` e os totais corretos. Ao alterar filtros ou busca, volte para `pagina=0`; para carregar mais, incremente `pagina` enquanto `temProxima=true`. As ordenações têm um segundo critério por ID para manter a ordem estável.

### Produto e adicional

ProdutoView, usado em GET /mesa/cardapio e nas rotas administrativas de produtos:

~~~json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "nome": "X-Burger",
  "descricao": null,
  "categoria": "HAMBURGUERES",
  "preco": 16.00,
  "imagemUrl": "/api/v1/imagens/produtos/11111111-1111-4111-8111-111111111111.svg",
  "estacao": "COZINHA",
  "tempoPreparoEstimadoMin": 20,
  "disponivel": true,
  "ativo": true,
  "adicionaisDisponiveis": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "nome": "Cheddar",
      "preco": 4.00,
      "ativo": true,
      "categorias": ["HAMBURGUERES", "PORCOES"]
    }
  ]
}
~~~

AdicionalView, usado em /admin/adicionais, tem exatamente os campos id, nome, preco, ativo e categorias mostrados dentro de adicionaisDisponiveis. A ordem do array categorias não é garantida. Categorias possíveis: ENTRADAS, PORCOES, HAMBURGUERES, MASSAS, PIZZAS, PRATOS_PRINCIPAIS, BEBIDAS, SOBREMESAS. Estações: COZINHA e BAR.

GET /mesa/cardapio devolve somente produtos com ativo=true; um produto pode aparecer com disponivel=false, que a UI deve marcar como esgotado e impedir de adicionar. Use `categoria=HAMBURGUERES` e/ou `busca=burger` para filtrar o cardápio sem alterar o formato array; a busca ignora maiúsculas/minúsculas e espaços nas pontas. A lista adicionaisDisponiveis já foi filtrada por categoria e atividade. PRATOS_PRINCIPAIS e BEBIDAS não aceitam adicionais. O mesmo pedido pode ter itens de COZINHA e BAR.

### Pedido, item e comanda

PedidoView, devolvido ao criar/alterar/enviar/cancelar um pedido e ao mover um cartão:

~~~json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "comandaId": "44444444-4444-4444-8444-444444444444",
  "status": "RECEBIDO",
  "numeroDiario": 12,
  "diaOperacional": "2026-11-04",
  "observacaoGeral": "Sem gelo",
  "criadoEm": "2026-11-04T18:55:00Z",
  "enviadoEm": "2026-11-04T19:00:00Z",
  "versao": 2,
  "itens": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "produtoId": "11111111-1111-4111-8111-111111111111",
      "nomeProduto": "X-Burger",
      "quantidade": 2,
      "observacao": "Sem cebola",
      "precoUnitario": 16.00,
      "estacao": "COZINHA",
      "adicionais": [
        {
          "id": "22222222-2222-4222-8222-222222222222",
          "nome": "Cheddar",
          "preco": 4.00
        }
      ],
      "subtotal": 40.00
    }
  ],
  "subtotal": 40.00
}
~~~

Em RASCUNHO, numeroDiario, diaOperacional e enviadoEm são null. O item guarda nome e preço do produto e de cada adicional no momento em que foi adicionado; mudanças posteriores no cardápio não alteram esse pedido. Subtotal do item = (precoUnitario + soma dos adicionais) × quantidade. A UI pode mostrar o subtotal, mas sempre deve confiar no valor do servidor. O numeroDiario é gerado no envio, é único dentro do dia operacional e pode reiniciar no dia seguinte.

ComandaView, devolvida em /mesa/comanda e /admin/comandas:

~~~json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "status": "ABERTA",
  "numeroMesa": 1,
  "abertaEm": "2026-11-04T18:55:00Z",
  "taxaServicoPercentual": 10.00,
  "couvert": 0.00,
  "pedidos": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "comandaId": "44444444-4444-4444-8444-444444444444",
      "status": "RECEBIDO",
      "numeroDiario": 12,
      "diaOperacional": "2026-11-04",
      "observacaoGeral": "Sem gelo",
      "criadoEm": "2026-11-04T18:55:00Z",
      "enviadoEm": "2026-11-04T19:00:00Z",
      "versao": 2,
      "itens": [],
      "subtotal": 40.00
    }
  ],
  "subtotal": 40.00,
  "taxaServico": 4.00,
  "total": 44.00
}
~~~

O exemplo acima abrevia itens do pedido; em uma resposta real, eles seguem o formato completo de PedidoView. O subtotal da comanda soma somente pedidos enviados e não cancelados. Total = subtotal + taxaServico + couvert. A taxa percentual e o couvert são fixados na abertura; garçom e gerente podem removê-los durante o fechamento. O gerente define o couvert global em GET/PUT `/admin/configuracao/couvert` com corpo `{"valor":12.00}`. A mudança vale somente para novas comandas.

### Demais formatos

~~~json
// EstadoMesa — GET /mesa/estado
{"estado":"EM_ATENDIMENTO","numeroMesa":1}

// MesaView
{"id":"66666666-6666-4666-8666-666666666666","numero":1,"capacidade":4,"ativa":true}

// UsuarioView — nunca contém senha ou hash
{"id":"77777777-7777-4777-8777-777777777777","nome":"Ana","username":"ana","papel":"GARCOM","ativo":true}

// DispositivoView — nunca contém token ou hash
{"id":"88888888-8888-4888-8888-888888888888","mesaId":"66666666-6666-4666-8666-666666666666","numeroMesa":1,"nome":"Tablet mesa 1","ativo":true,"pareadoEm":"2026-11-04T19:00:00Z","ultimoAcessoEm":null,"online":false}

// ChamadoView — resposta do tablet
{"id":"99999999-9999-4999-8999-999999999999","tipo":"AJUDA","status":"ABERTO","criadoEm":"2026-11-04T19:00:00Z"}

// ChamadoAdminView — resposta da equipe
{"id":"99999999-9999-4999-8999-999999999999","tipo":"AJUDA","status":"ABERTO","criadoEm":"2026-11-04T19:00:00Z","atendidoEm":null,"numeroMesa":1}
~~~

O bloco anterior reúne exemplos independentes; linhas iniciadas por // são comentários explicativos, não JSON de uma única resposta.

Kanban:

~~~json
{
  "recebido": [
    {
      "pedido": { "...": "PedidoView completo" },
      "numeroMesa": 1,
      "minutosDecorridos": 3,
      "atrasado": false
    }
  ],
  "emPreparo": [],
  "pronto": []
}
~~~

O campo pedido do cartão contém todos os campos de PedidoView. Um cartão é considerado atrasado enquanto estiver em RECEBIDO ou EM_PREPARO e ultrapassar o maior tempo estimado dos produtos do pedido mais a margem configurada (5 minutos por padrão).

## 4. Catálogo completo de endpoints

Nas tabelas, “sem corpo” significa que a requisição não envia JSON; “vazio” significa resposta HTTP 200 sem JSON. Os nomes de formatos apontam para os exemplos acima ou para os payloads detalhados na seção 5.

### 4.1 Públicos

| Método e caminho | Corpo da requisição | Corpo da resposta |
| --- | --- | --- |
| POST /auth/login | LoginInput | LoginView |
| POST /dispositivos/pareamento | Sem corpo | SolicitacaoPareamento |
| GET /dispositivos/pareamento/{solicitacaoId} | Sem corpo | EstadoPareamento; pode retornar 410 |
| GET /imagens/produtos/{id}.svg | Sem corpo | Imagem SVG de produto de referência |

### 4.2 Tablet: Bearer do dispositivo

| Método e caminho | Corpo da requisição | Corpo da resposta |
| --- | --- | --- |
| GET /mesa/estado | Sem corpo | EstadoMesa |
| GET /mesa/cardapio?categoria=...&busca=... | Sem corpo; filtros opcionais | Array de ProdutoView |
| GET /mesa/comanda | Sem corpo | ComandaView; sem comanda ativa, 200 sem corpo |
| POST /mesa/pedidos | Sem corpo | PedidoView RASCUNHO; abre comanda se preciso |
| POST /mesa/pedidos/{id}/itens | ItemInput | PedidoView atualizado |
| PATCH /mesa/pedidos/{id}/itens/{itemId} | ItemInput completo | PedidoView atualizado |
| DELETE /mesa/pedidos/{id}/itens/{itemId} | Sem corpo | PedidoView atualizado |
| POST /mesa/pedidos/{id}/enviar | EnvioInput opcional; pode ser sem corpo | PedidoView RECEBIDO ou estado já alcançado |
| POST /mesa/pedidos/{id}/cancelar | Sem corpo | PedidoView CANCELADO |
| POST /mesa/chamados | ChamadoInput | ChamadoView |
| POST /mesa/desparear | Sem corpo | 200 vazio; revoga o próprio token do tablet |
| GET /mesa/pedidos/{id}/eventos | Sem corpo | Fluxo text/event-stream; pedido precisa pertencer ao tablet |

O campo id das rotas de pedido é o UUID do **pedido**, não numeroDiario. Nenhuma rota do tablet recebe mesaId, inclusive na URL. Para obter a lista de pedidos da mesa, consulte /mesa/comanda; não existe GET /mesa/pedidos/{id} nesta versão.

### 4.3 Equipe: Bearer JWT

| Método e caminho | Corpo da requisição | Corpo da resposta |
| --- | --- | --- |
| GET /admin/kanban?estacao=COZINHA ou BAR | Sem corpo; estacao opcional | Kanban |
| PATCH /admin/kanban/{id}/status | TransicaoInput | PedidoView atualizado |
| GET /admin/kanban/eventos | Sem corpo | Fluxo text/event-stream |
| POST /admin/dispositivos/pareamento/aprovar | AprovarInput | DispositivoView |
| GET /admin/dispositivos | Sem corpo | Array de DispositivoView, inclusive inativos |
| PATCH /admin/dispositivos/{id} | DispositivoInput parcial | DispositivoView atualizado |
| DELETE /admin/dispositivos/{id} | Sem corpo | 200 vazio; revoga o token imediatamente |
| GET /admin/comandas?pagina=0&tamanho=20&status=ATIVAS | Sem corpo; parâmetros opcionais | Página de ComandaView; status padrão ATIVAS |
| GET /admin/comandas/resumos?pagina=0&tamanho=20&status=ATIVAS | Mesmos filtros da listagem completa | Página de resumos com id, status, numeroMesa, abertaEm, subtotal, taxaServico e total; sem pedidos/itens |
| POST /admin/comandas | AbrirComandaInput | ComandaView; também cria rascunho |
| GET /admin/comandas/{id} | Sem corpo | ComandaView, inclusive paga |
| POST /admin/comandas/{id}/fechar | FechamentoInput | FechamentoView |
| POST /admin/comandas/{id}/retomar | Sem corpo | ComandaView; retoma comanda aguardando pagamento |
| POST /admin/comandas/{id}/reabrir | `{"motivo":"..."}` | ComandaView; reabre comanda paga |
| GET /admin/chamados?pagina=0&tamanho=20&status=ABERTO | Sem corpo; parâmetros opcionais | Página de ChamadoAdminView; sem status, inclui todos |
| PATCH /admin/chamados/{id} | AtendimentoInput | ChamadoAdminView atualizado |
| GET /admin/dashboard/fechamento-diario?dia=YYYY-MM-DD | Sem corpo; dia opcional | FechamentoDiario |

### 4.4 Gerência: Bearer JWT de GERENTE

| Método e caminho | Corpo da requisição | Corpo da resposta |
| --- | --- | --- |
| GET /admin/produtos?pagina=0&tamanho=20&categoria=HAMBURGUERES&ativo=true&busca=burger | Sem corpo; filtros opcionais | Página de ProdutoView, inclusive inativos se ativo omitido |
| GET /admin/produtos/{id} | Sem corpo | ProdutoView |
| POST /admin/produtos | ProdutoInput completo | ProdutoView |
| PATCH /admin/produtos/{id} | ProdutoInput completo | ProdutoView atualizado |
| PATCH /admin/produtos/{id}/disponibilidade | DisponibilidadeInput | 200 vazio |
| DELETE /admin/produtos/{id} | Sem corpo | 200 vazio; desativa produto e disponibilidade |
| GET /admin/adicionais | Sem corpo | Array de AdicionalView, inclusive inativos |
| GET /admin/adicionais/{id} | Sem corpo | AdicionalView |
| POST /admin/adicionais | AdicionalInput completo | AdicionalView |
| PATCH /admin/adicionais/{id} | AdicionalInput completo | AdicionalView atualizado |
| PUT /admin/adicionais/{id}/categorias | Array JSON puro de categorias | 200 vazio |
| DELETE /admin/adicionais/{id} | Sem corpo | 200 vazio; desativa adicional |
| GET /admin/mesas | Sem corpo | Array de MesaView, inclusive inativas |
| GET /admin/mesas/{id} | Sem corpo | MesaView |
| POST /admin/mesas | MesaInput completo | MesaView |
| PATCH /admin/mesas/{id} | MesaInput completo | MesaView atualizado |
| DELETE /admin/mesas/{id} | Sem corpo | 200 vazio; desativa mesa |
| GET /admin/usuarios?pagina=0&tamanho=20 | Sem corpo; parâmetros opcionais | Página de UsuarioView, inclusive inativos |
| GET /admin/usuarios/{id} | Sem corpo | UsuarioView |
| POST /admin/usuarios | UsuarioInput com senha | UsuarioView |
| PATCH /admin/usuarios/{id} | UsuarioInput; senha opcional | UsuarioView atualizado |
| DELETE /admin/usuarios/{id} | Sem corpo | 200 vazio; desativa usuário |
| GET /admin/configuracao/couvert | Sem corpo | `{"valor":12.00}` |
| PUT /admin/configuracao/couvert | `{"valor":12.00}` | Valor atualizado; afeta novas comandas |

Os PATCH de produto, adicional, mesa e usuário **não são alterações parciais de campos**: envie os dados atuais completos com os campos alterados. Valores booleanos omitidos podem virar false. PATCH de dispositivo, por sua vez, aceita nome e/ou mesaId opcionais.

## 5. Corpos de requisição e respostas especiais

Os exemplos são JSON enviado à API, exceto onde indicado. Substitua os UUIDs pelos obtidos em respostas anteriores. Campos booleanos de records Java devem ser enviados explicitamente nos formulários completos.

### 5.1 Login e pareamento

LoginInput para POST /auth/login:

~~~json
{"username":"admin","senha":"sua-senha"}
~~~

LoginView:

~~~json
{"token":"<jwt>","expiraEm":"2026-11-05T03:00:00Z","papel":"GERENTE"}
~~~

POST /dispositivos/pareamento não recebe corpo. SolicitacaoPareamento:

~~~json
{
  "solicitacaoId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "codigo": "ABC234",
  "expiraEm": "2026-11-04T19:10:00Z"
}
~~~

AprovarInput para POST /admin/dispositivos/pareamento/aprovar:

~~~json
{"codigo":"ABC234","mesaId":"66666666-6666-4666-8666-666666666666"}
~~~

GET /dispositivos/pareamento/{solicitacaoId} devolve EstadoPareamento:

~~~json
{"status":"PENDENTE","token":null}
~~~

Depois de aprovado, **uma única consulta** devolve:

~~~json
{"status":"CONSUMIDA","token":"<token-aleatorio-do-tablet>"}
~~~

O status interno APROVADA é consumido nessa leitura; o frontend pode não recebê-lo. Consultas posteriores dão 410. O código tem validade de 10 minutos. Se o servidor reiniciar entre a aprovação e a leitura, o token não pode ser recuperado; solicite novo pareamento. O token não aparece na resposta administrativa nem em GET /admin/dispositivos.

DispositivoInput para PATCH /admin/dispositivos/{id}:

~~~json
{"nome":"Tablet do salão","mesaId":"66666666-6666-4666-8666-666666666666"}
~~~

Pode-se enviar só nome ou só mesaId. A resposta é DispositivoView. Ao mudar mesaId, o **mesmo token** passa a representar a nova mesa imediatamente. Só pode existir um tablet ativo por mesa. O campo online é true quando ultimoAcessoEm ocorreu há menos de 2 minutos. Qualquer chamada autenticada em /mesa/** renova ultimoAcessoEm no máximo uma vez a cada 30 segundos.

### 5.2 Pedido do tablet

ItemInput para POST e PATCH de item:

~~~json
{
  "produtoId": "11111111-1111-4111-8111-111111111111",
  "quantidade": 2,
  "observacao": "Sem cebola",
  "adicionaisIds": ["22222222-2222-4222-8222-222222222222"]
}
~~~

Quantidade mínima 1; observacao até 200 caracteres; adicionaisIds é um conjunto de IDs. Cada adicional precisa estar ativo e habilitado para a categoria do produto. O produto precisa estar ativo e disponível. O servidor rejeita preço enviado pelo cliente. POST cria item; PATCH substitui os dados completos do item, preservando seu itemId; DELETE remove o item. As três ações só funcionam enquanto o pedido está em RASCUNHO e devolvem PedidoView com versao incrementada.

EnvioInput para POST /mesa/pedidos/{id}/enviar (corpo opcional):

~~~json
{"observacaoGeral":"Entregar tudo junto"}
~~~

O pedido deve ter ao menos um item. Enviar pela segunda vez o **mesmo ID** devolve PedidoView no estado atual, com o mesmo numeroDiario; não abre outro pedido nem consome outro número. Exiba confirmação de envio usando o estado devolvido pela API.

ChamadoInput para POST /mesa/chamados:

~~~json
{"tipo":"AJUDA"}
~~~

Valores aceitos de tipo: GARCOM, CONTA e AJUDA. A resposta é ChamadoView.

### 5.3 Kanban e chamados

TransicaoInput para PATCH /admin/kanban/{id}/status:

~~~json
{"novoStatus":"EM_PREPARO","motivo":null,"versao":2}
~~~

Use sempre a versao recebida no PedidoView mais recente; duas pessoas tentando alterar a mesma versão causam 409 para uma delas. A resposta é PedidoView com status e versao atualizados. Caminho normal:

~~~text
RASCUNHO -> RECEBIDO -> EM_PREPARO -> PRONTO -> ENTREGUE
RECEBIDO, EM_PREPARO ou PRONTO -> CANCELADO
~~~

RASCUNHO -> RECEBIDO acontece somente no envio pelo tablet. No Kanban, COZINHA, GARCOM ou GERENTE podem avançar um passo. CANCELADO exige motivo. Em RECEBIDO, cancelamento pelo Kanban exige GERENTE; o tablet pode cancelar seu próprio pedido ainda em RECEBIDO. Em EM_PREPARO ou PRONTO, a equipe autorizada do Kanban pode cancelar com motivo. GARCOM e GERENTE podem retroceder de EM_PREPARO, PRONTO ou ENTREGUE para um estado anterior entre RECEBIDO, EM_PREPARO e PRONTO, também com motivo. ENTREGUE não pode ser cancelado. Transição inválida dá 409 com estadoAtual e transicoesPermitidas.

AtendimentoInput para PATCH /admin/chamados/{id}:

~~~json
{"status":"ATENDIDO"}
~~~

O único status de destino aceito é ATENDIDO. Se já atendido, devolve 409. A resposta é ChamadoAdminView com atendidoEm preenchido.

### 5.4 Comanda e pagamento

AbrirComandaInput para POST /admin/comandas:

~~~json
{"mesaId":"66666666-6666-4666-8666-666666666666"}
~~~

Isso abre/recupera a comanda e cria/recupera um rascunho. No tablet, POST /mesa/pedidos faz a mesma abertura usando a mesa do token. Status da comanda: ABERTA, AGUARDANDO_PAGAMENTO, PAGA e CANCELADA. Não há endpoint público para cancelar uma comanda. GET /admin/comandas aceita `status=ATIVAS` (padrão: ABERTA e AGUARDANDO_PAGAMENTO), ABERTA, AGUARDANDO_PAGAMENTO, PAGA ou CANCELADA; use `status=PAGA` para consultar o histórico. Também é possível ler uma comanda por ID em /admin/comandas/{id}. Para telas de listagem, prefira GET /admin/comandas/resumos com os mesmos filtros e paginação; esse endpoint omite pedidos e itens, preservando os totais. A listagem completa continua disponível com o formato anterior.

FechamentoInput para POST /admin/comandas/{id}/fechar:

~~~json
{
  "pagamentos": [
    {"forma":"PIX","valor":22.00},
    {"forma":"DINHEIRO","valor":22.00,"valorRecebido":30.00}
  ],
  "removerTaxa": false,
  "removerCouvert": false,
  "forcar": false
}
~~~

Formas possíveis: DINHEIRO, PIX, CARTAO_CREDITO e CARTAO_DEBITO. A soma dos valores **aplicados** deve ser exatamente total da comanda. valorRecebido só pode ser informado para DINHEIRO e deve ser maior ou igual a valor. O troco é a soma de (valorRecebido - valor) de pagamentos em dinheiro; não é armazenado. Sem gateway de pagamento: essa rota **registra** um pagamento confirmado pela equipe.

Todos os pedidos da comanda precisam estar ENTREGUE ou CANCELADO. Só GERENTE pode usar forcar=true para ignorar pendências. `removerTaxa=true` zera a taxa percentual e `removerCouvert=true` zera o couvert antes de calcular o total. Para mostrar a conta antes de cobrar, pode-se chamar a rota com pagamentos=[]; isso muda o status para AGUARDANDO_PAGAMENTO e devolve o total atualizado. Em seguida, faça GET /mesa/comanda ou GET /admin/comandas/{id} e envie outra chamada com os pagamentos exatos. `POST /admin/comandas/{id}/retomar` volta a comanda para ABERTA e restaura taxa/couvert removidos durante a preparação. `POST /admin/comandas/{id}/reabrir` exige uma comanda PAGA, motivo de 3 a 500 caracteres e ausência de comanda mais recente na mesa; registra a reabertura e estorna os pagamentos registrados. Enquanto aguarda pagamento, POST /mesa/pedidos rejeita novo rascunho com 409.

AGUARDANDO_PAGAMENTO também bloqueia edição, remoção e envio de itens de rascunhos existentes, cancelamentos e retrocessos no Kanban. Os pedidos enviados podem continuar avançando até ENTREGUE. No fechamento forçado com pagamento, rascunhos não cobrados passam a CANCELADO com histórico; repetir o envio desses IDs apenas devolve CANCELADO, sem gerar número diário. Pedidos cobrados podem ser preparados e entregues após o fechamento forçado, mas não cancelados nem retrocedidos. Subtotal, taxa e total da conta paga são preservados no fechamento. Falhas de validação de pagamentos revertem integralmente a operação.

FechamentoView:

~~~json
{
  "comanda": {
    "id": "44444444-4444-4444-8444-444444444444",
    "status": "PAGA",
    "numeroMesa": 1,
    "abertaEm": "2026-11-04T18:55:00Z",
    "taxaServicoPercentual": 10.00,
    "couvert": 0.00,
    "pedidos": [],
    "subtotal": 40.00,
    "taxaServico": 4.00,
    "total": 44.00
  },
  "troco": 8.00
}
~~~

O array pedidos acima foi abreviado para facilitar a leitura; a resposta real inclui os pedidos da comanda. Quando pagamentos=[], troco=0.00 e o status retornado é AGUARDANDO_PAGAMENTO. Depois que o status é PAGA, o token do tablet da mesa é revogado na mesma transação. Chamadas `/mesa/**` com esse token recebem 401; limpe token, carrinho, IDs e dados da conta anterior e inicie novo pareamento. Um tablet recém-pareado sem comanda ativa recebe `LIVRE` em GET /mesa/estado.

### 5.5 Administração do cardápio, mesas e usuários

ProdutoInput para POST e PATCH /admin/produtos:

~~~json
{
  "nome": "Hambúrguer da casa",
  "descricao": "Pão, carne e molho",
  "categoria": "HAMBURGUERES",
  "preco": 29.90,
  "imagemUrl": "https://exemplo.com/imagens/burger.jpg",
  "estacao": "COZINHA",
  "tempoPreparoEstimadoMin": 20,
  "disponivel": true,
  "ativo": true
}
~~~

nome até 120 caracteres; preco não negativo e até duas casas; no POST/PATCH, imagemUrl pode ser null ou URL HTTP(S) de até 1000 caracteres; tempoPreparoEstimadoMin mínimo 1. Os produtos do seed recebem uma URL relativa `/api/v1/imagens/produtos/{id}.svg`, acessível por GET público. Ao editar um produto de demonstração via PATCH, envie null ou uma URL HTTP(S) no campo imagemUrl. Quando a imagem local é substituída ou o produto é desativado por DELETE /admin/produtos/{id} ou PATCH com ativo=false, o arquivo é removido após a confirmação da transação. Imagens órfãs são removidas na inicialização e a cada 5 minutos, inclusive após exclusão direta de uma linha no banco. Para mudar só a disponibilidade, use PATCH /admin/produtos/{id}/disponibilidade:

~~~json
{"disponivel":false}
~~~

AdicionalInput para POST e PATCH /admin/adicionais:

~~~json
{
  "nome": "Cheddar",
  "preco": 4.00,
  "ativo": true,
  "categorias": ["HAMBURGUERES", "PORCOES"]
}
~~~

nome até 120 caracteres; preco não negativo. PRATOS_PRINCIPAIS e BEBIDAS não podem constar em categorias; a API devolve 422. PUT /admin/adicionais/{id}/categorias recebe diretamente um **array JSON**, não um objeto:

~~~json
["HAMBURGUERES", "PORCOES"]
~~~

MesaInput para POST e PATCH /admin/mesas:

~~~json
{"numero":13,"capacidade":4,"ativa":true}
~~~

numero e capacidade mínimos 1; numero é único. DELETE apenas torna ativa=false. Mesa inativa deixa de autenticar seu tablet.

UsuarioInput para POST /admin/usuarios:

~~~json
{"nome":"Ana","username":"ana","senha":"senha-de-8-ou-mais","papel":"GARCOM","ativo":true}
~~~

nome até 120 caracteres; username até 80 e único; senha com pelo menos 8 caracteres; papel COZINHA, GARCOM ou GERENTE. PATCH envia nome, username, papel e ativo novamente; senha é opcional e, quando ausente, a senha anterior permanece. Exemplo:

~~~json
{"nome":"Ana Silva","username":"ana","papel":"GARCOM","ativo":true}
~~~

DELETE apenas torna ativo=false; usuários inativos não conseguem fazer login. Nenhuma resposta de usuário inclui senha ou hash.

### 5.6 Dashboard

GET /admin/dashboard/fechamento-diario aceita dia=YYYY-MM-DD. Sem dia, usa o dia operacional atual. FechamentoDiario contém todos os campos:

~~~json
{
  "dia": "2026-11-04",
  "totalVendido": 160.00,
  "totalPedidos": 7,
  "totalCancelados": 1,
  "valorCancelado": 16.00,
  "taxaServicoArrecadada": 8.00,
  "ticketMedioPorComanda": 44.00,
  "top10Itens": [
    {"nome":"X-Burger","quantidade":4,"receita":64.00}
  ],
  "vendasPorCategoria": [
    {"categoria":"HAMBURGUERES","receita":64.00}
  ],
  "vendasPorHora": [
    {"hora":16,"receita":64.00}
  ],
  "tempoMedioPreparoMin": 12.50,
  "tempoMedioEntregaMin": 4.25,
  "pedidosAtrasados": 2,
  "vendasPorFormaPagamento": [
    {"forma":"PIX","valor":30.00},
    {"forma":"DINHEIRO","valor":14.00}
  ]
}
~~~

As quantias do exemplo são ilustrativas e não precisam fechar entre si. totalVendido e as vendas por item/categoria/hora usam o dia operacional do **pedido** e excluem pedidos CANCELADO; totalVendido soma itens, sem taxa e couvert. totalCancelados e valorCancelado se referem a pedidos enviados e cancelados nesse dia. taxaServicoArrecadada, ticketMedioPorComanda e vendasPorFormaPagamento usam o dia operacional de **fechamento da comanda**. vendasPorHora usa hora local do restaurante (0 a 23). Os tempos médios vêm do histórico RECEBIDO -> PRONTO e PRONTO -> ENTREGUE; podem ser null quando não há dados. pedidosAtrasados conta somente pedidos atualmente em RECEBIDO/EM_PREPARO do dia selecionado.

Vendas por categoria usam a categoria preservada no item ao montar o pedido. Reclassificar o produto não modifica os itens anteriores. Taxa arrecadada e ticket médio usam os valores preservados no fechamento. Nas médias, cada pedido não cancelado conta uma vez por etapa: usa-se a última conclusão registrada e o início correspondente mais recente anterior a ela. Isso evita multiplicar amostras quando o gerente retrocede um pedido.

## 6. Fluxos que o frontend deve implementar

### 6.1 Parear um tablet novo

1. Sem token armazenado, mostrar tela com um código obtido por POST /dispositivos/pareamento. Guarde solicitacaoId em memória e mostre expiraEm como contagem regressiva.
2. Um GARCOM ou GERENTE logado escolhe uma mesa ativa no painel e envia codigo + mesaId a POST /admin/dispositivos/pareamento/aprovar. Se a mesa já tiver tablet ativo, resolver a duplicidade no painel de dispositivos antes de aprovar.
3. No tablet, consultar GET /dispositivos/pareamento/{solicitacaoId} a cada aproximadamente 2–5 segundos. O polling tem cota própria de 60 requisições/minuto por IP e solicitação, separada do login e da criação do código. PENDENTE mantém a tela; CONSUMIDA com token conclui. Em 429, respeite Retry-After.
4. Guardar o token no armazenamento persistente do tablet, apagar o código da UI e abrir a experiência da mesa. O UUID da solicitação não é o token. Não depender de uma segunda leitura do token.
5. Se retornar 410, mostrar opção para gerar outro código. Se chamadas /mesa/** retornarem 401, remover o token local e iniciar pareamento novamente.

### 6.2 Experiência do cliente na mesa

1. Com token válido, chamar GET /mesa/estado e GET /mesa/cardapio. LIVRE indica ausência de comanda ativa; o cliente ainda pode navegar no cardápio.
2. Ao iniciar compra, POST /mesa/pedidos abre/recupera a comanda e o único rascunho da mesa. Guarde pedido.id. Mostre itens e total do pedido a partir de PedidoView.
3. Adicionar, substituir ou remover itens somente no rascunho. Exibir adicionaisDisponiveis para o produto escolhido. Desabilitar produtos com disponivel=false.
4. Enviar pelo POST /mesa/pedidos/{id}/enviar. Exibir numeroDiario e diaOperacional. Em caso de perda de resposta, repetir **o mesmo pedidoId**; o envio é idempotente. Criar outro rascunho para um novo pedido.
5. Consultar GET /mesa/comanda para mostrar todos os pedidos da sessão atual. É esse endpoint que permite recuperar a tela após recarregar o frontend. Para atualização rápida de um pedido, ouvir SSE por pedido e então refazer GET /mesa/comanda.
6. O cliente pode cancelar seu próprio pedido somente enquanto status=RECEBIDO. Pode chamar o garçom com tipo GARCOM, CONTA ou AJUDA.
7. Quando o garçom inicia o fechamento sem pagamento, estado da mesa vira AGUARDANDO_PAGAMENTO; mostre o valor e bloqueie criação de pedidos. Quando a conta fica PAGA, o tablet é revogado na mesma transação e volta ao pareamento. Apague dados de carrinho/comanda/pedido da sessão anterior para o próximo cliente.

### 6.3 Cozinha, bar e garçom

1. A equipe faz POST /auth/login e guarda o JWT até expirar. A UI deve adaptar menus pelo papel.
2. Cozinha e bar fazem GET /admin/kanban com estacao=COZINHA ou BAR e assinam GET /admin/kanban/eventos. O retorno tem colunas recebido, emPreparo e pronto ordenadas por enviadoEm. ENTREGUE e CANCELADO saem do Kanban.
3. Um pedido misto aparece nos filtros de COZINHA e BAR, mas existe **um único status para o pedido inteiro**. Não crie estados independentes por estação. Antes de mover, use a versao atual do cartão; ao receber 409, atualize o Kanban.
4. Garçom consulta e atende chamados, consulta a comanda, inicia AGUARDANDO_PAGAMENTO se precisar e registra valores aplicados e troco. A API não processa PIX/cartão; a confirmação financeira acontece fora dela.
5. Gerente administra dados e vê o dashboard. Desativar produto/adicional não modifica snapshots de pedidos já criados.

### 6.4 SSE com Bearer

Rotas:

~~~text
GET /api/v1/admin/kanban/eventos              JWT da equipe
GET /api/v1/mesa/pedidos/{pedidoId}/eventos   token do tablet
~~~

As respostas são text/event-stream e emitem imediatamente:

~~~text
event: conectado
data: {"ok":true}

event: pedido
data: {"pedidoId":"33333333-3333-4333-8333-333333333333","status":"PRONTO"}
~~~

O evento pedido é enviado **depois do commit** da mudança no banco. Use fetch com header Authorization: Bearer; EventSource nativo não permite definir esse header. Ao conectar, reconectar ou receber pedido, refaça GET /admin/kanban ou GET /mesa/comanda conforme a tela. O stream não envia snapshot inicial, não tem replay nem IDs de evento. Feche a conexão ao sair da tela ou trocar de usuário. A publicação em memória presume uma instância do backend.

Comentários `:heartbeat` são enviados a cada 15 segundos e podem ser ignorados pelo parser. Cada conexão dura no máximo 30 minutos; reconecte com espera progressiva e consulte novamente os dados. O acesso é revalidado antes de cada evento/heartbeat: revogação ou mudança de mesa do dispositivo, desativação da mesa/usuário, mudança de papel ou expiração do JWT encerram o stream. Ao receber 401/403 na reconexão, interrompa as tentativas e refaça autenticação/pareamento conforme o caso.

## 7. Ambiente de desenvolvimento e limites conhecidos

- O seed normal cria 12 mesas, 43 produtos listados na especificação, 20 adicionais, imagens SVG genéricas para os produtos e um gerente quando ADMIN_USERNAME/ADMIN_PASSWORD são definidos. O seed não duplica dados no reinício e não troca a senha de um gerente já existente. As imagens são armazenadas em PRODUCT_IMAGES_DIR (padrão `./data/product-images`; volume `product_images` no Compose).
- O perfil dev adiciona usuários dev_cozinha_1/2, dev_garcom_1/2 e dev_gerente_1/2, todos com senha dev12345678, além de tablets, pelo menos 54 pedidos (45 históricos pagos e 9 ativos), 12 chamados e solicitações de pareamento. Não use esses dados como comportamento obrigatório de produção.
- Rascunhos sem atualização por 30 minutos são removidos por job executado a cada 5 minutos. A UI deve tratar pedido que desapareceu com 404 e permitir criar outro.
- A API não oferece endpoint de logout, detalhe isolado de pedido do tablet, upload de imagens, estoque, separação de conta ou checkout online.
- Coleção Bruno com exemplos de todas as áreas: ../bruno/README.md. Instruções de execução e variáveis: ../README.md. Decisões do backend: DECISOES.md.
