# Plateon — pedidos por tablet e KDS

API em Java 21, Spring Boot 4.1.2 e MySQL 8.4. O tablet fixo da mesa consulta o cardápio, envia pedidos e acompanha status; a equipe usa JWT para pareamento, Kanban, conta e administração. O frontend está em [`../frontend`](../frontend/README.md), e o contrato detalhado da API está em [`docs/docs.md`](docs/docs.md).

## Subir com Docker Compose

Para subir frontend, API e banco juntos em um comando, siga o [Compose da raiz](../README.md). Este Compose local ao backend continua disponível para rodar apenas API e banco.

Requisitos: Docker com Compose e portas 3306 e 8081 livres para este Compose. O Compose da raiz publica somente a API na interface local e não publica a porta do MySQL.

```bash
export JWT_SECRET="$(openssl rand -base64 48)"
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD='uma-senha-forte-com-8-ou-mais-caracteres'
docker compose up --build -d
```

O Compose inicia MySQL 8.4, aguarda o health check e inicia a aplicação. Flyway aplica as migrations disponíveis até `V13` no primeiro boot. O seed de referência cria mesas, cardápio, adicionais e o gerente informado pelas variáveis; reinícios não duplicam os dados. As imagens de produtos ficam no volume `product_images`; em execução no host, o diretório padrão é `./data/product-images` e pode ser alterado com `PRODUCT_IMAGES_DIR`.

Confira `http://localhost:8081/actuator/health` e abra `http://localhost:8081/swagger-ui.html`. Os documentos OpenAPI ficam em `/v3/api-docs`.

O frontend Next.js abre em `http://127.0.0.1:3000` quando iniciado separadamente e encaminha `/api/v1` para esta API. Nesse acesso pelo frontend, não é necessário configurar `CORS_ORIGINS`.

Para os dados de demonstração, defina `SPRING_PROFILES_ACTIVE=dev` antes de `docker compose up --build -d`. O perfil cria usuários `dev_cozinha_1`/`2`, `dev_garcom_1`/`2` e `dev_gerente_1`/`2`, todos com senha `dev12345678`; tablets das mesas livres 1 a 10 usam tokens `dev-tablet-1` a `dev-tablet-10` (o 10 é revogado). Também cria pelo menos 54 pedidos, 45 comandas pagas, 12 chamados e solicitações de pareamento. O perfil é apenas para desenvolvimento. A migração V11 converte usuários antigos do papel CAIXA para GARCOM.

## Rodar a aplicação no host com Java 21

Instale o JDK 21 e use o Maven Wrapper. Se o JDK 21 não for o padrão do host, configure `JAVA_HOME` antes de executar os comandos.

```bash
export DB_URL='jdbc:mysql://localhost:3306/pedidos_mesa?connectionTimeZone=UTC'
export DB_USERNAME=plateon
export DB_PASSWORD=plateon
export JWT_SECRET="$(openssl rand -base64 48)"
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD='uma-senha-forte-com-8-ou-mais-caracteres'
docker compose up -d mysql
./mvnw spring-boot:run
```

Para testar: `./mvnw test` (no Windows, `.\mvnw.cmd test`). Os testes de integração usam Testcontainers e precisam de um Docker Engine acessível; os testes unitários rodam sem Docker. `FluxoIntegrationTest`, `MigrationIntegrationTest`, `SegurancaIntegrationTest` e `ConfiabilidadeIntegrationTest` aceitam, respectivamente, `PLATEON_TEST_JDBC`, `PLATEON_MIGRATION_TEST_JDBC`, `PLATEON_SECURITY_TEST_JDBC` e `PLATEON_RELIABILITY_TEST_JDBC`, cada uma apontando para um **banco MySQL 8.4 vazio e dedicado**, permitindo rodá-los sem Testcontainers. Os testes acrescentam `connectionTimeZone=UTC` à URL JDBC quando ela ainda não define esse parâmetro; mantenha UTC também nas URLs da aplicação para gravar corretamente as colunas `DATETIME`. O MySQL precisa das tabelas de fuso horário para os relatórios com `America/Sao_Paulo`.

A suíte verifica também fechamento forçado, bloqueio financeiro, envio concorrente com fechamento, rollback de pagamentos, preservação de categorias, médias com retrocessos, consultas em lote, limites de pareamento e SSE com revogação de acesso. Em instalações existentes, a V10 preenche os snapshots financeiros e de categoria com os dados disponíveis; alterações históricas anteriores não podem ser reconstruídas.

Para gerar cobertura sem alterar o `pom.xml`:

```bash
mvn org.jacoco:jacoco-maven-plugin:0.8.16:prepare-agent test org.jacoco:jacoco-maven-plugin:0.8.16:report
```

Abra `target/site/jacoco/index.html`. Na validação com MySQL 8.4, a cobertura combinada de linhas em `service` e `domain` foi 72,1% (86,4% em `service` e 45,0% em `domain`, onde há entidades JPA com getters e setters manuais).

## Fluxo mínimo via curl

Os exemplos usam `jq` para extrair IDs. Em cada comando, substitua os valores de ambiente conforme sua instalação.

1. Faça login como gerente:

```bash
BASE=http://localhost:8081/api/v1
JWT=$(curl -sS -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"senha\":\"$ADMIN_PASSWORD\"}" | jq -r .token)
```

2. Descubra a mesa, peça um código no tablet e aprove o pareamento:

```bash
MESA_ID=$(curl -sS "$BASE/admin/mesas" -H "Authorization: Bearer $JWT" | jq -r '.[0].id')
SOLICITACAO=$(curl -sS -X POST "$BASE/dispositivos/pareamento")
CODIGO=$(printf '%s' "$SOLICITACAO" | jq -r .codigo)
SOLICITACAO_ID=$(printf '%s' "$SOLICITACAO" | jq -r .solicitacaoId)
curl -sS -X POST "$BASE/admin/dispositivos/pareamento/aprovar" \
  -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d "{\"codigo\":\"$CODIGO\",\"mesaId\":\"$MESA_ID\"}"
TABLET=$(curl -sS "$BASE/dispositivos/pareamento/$SOLICITACAO_ID" | jq -r .token)
```

O token do tablet só é entregue uma vez. Guarde-o no tablet; o banco armazena somente seu hash. Se perder o token, o gerente deve revogar o dispositivo em `DELETE /admin/dispositivos/{id}` e parear novamente.

3. Consulte o cardápio, crie um pedido, adicione um item e envie:

```bash
PRODUTO_ID=$(curl -sS "$BASE/mesa/cardapio" -H "Authorization: Bearer $TABLET" | jq -r '.[0].id')
PEDIDO_ID=$(curl -sS -X POST "$BASE/mesa/pedidos" -H "Authorization: Bearer $TABLET" | jq -r .id)
curl -sS -X POST "$BASE/mesa/pedidos/$PEDIDO_ID/itens" \
  -H "Authorization: Bearer $TABLET" -H 'Content-Type: application/json' \
  -d "{\"produtoId\":\"$PRODUTO_ID\",\"quantidade\":1,\"adicionaisIds\":[]}"
curl -sS -X POST "$BASE/mesa/pedidos/$PEDIDO_ID/enviar" \
  -H "Authorization: Bearer $TABLET" -H 'Content-Type: application/json' \
  -d '{"observacaoGeral":"Teste"}'
```

4. Veja o Kanban e avance `RECEBIDO → EM_PREPARO → PRONTO → ENTREGUE`. Envie a `versao` recebida na resposta anterior em cada PATCH:

```bash
curl -sS "$BASE/admin/kanban?estacao=COZINHA" -H "Authorization: Bearer $JWT"
curl -sS -X PATCH "$BASE/admin/kanban/$PEDIDO_ID/status" \
  -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d '{"novoStatus":"EM_PREPARO","versao":2}'
```

5. Depois da entrega, consulte a comanda para obter `id` e `total`. Feche usando pagamentos que somem exatamente o total:

```bash
COMANDA=$(curl -sS "$BASE/mesa/comanda" -H "Authorization: Bearer $TABLET")
COMANDA_ID=$(printf '%s' "$COMANDA" | jq -r .id)
TOTAL=$(printf '%s' "$COMANDA" | jq -r .total)
curl -sS -X POST "$BASE/admin/comandas/$COMANDA_ID/fechar" \
  -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d "{\"pagamentos\":[{\"forma\":\"PIX\",\"valor\":$TOTAL}],\"removerTaxa\":false,\"forcar\":false}"
curl -sS "$BASE/mesa/estado" -H "Authorization: Bearer $TABLET"
```

Depois do pagamento, o token do tablet é revogado: a última chamada `/mesa/estado` com esse token deve retornar `401`. Pareie novamente para consultar o estado `LIVRE` da mesa. Para acompanhar eventos SSE antes do fechamento, faça `GET /mesa/pedidos/{id}/eventos` ou `GET /admin/kanban/eventos` com o Bearer no header usando um cliente que leia `text/event-stream` em streaming.

## Configuração e migrations

As propriedades `restaurante.*` ficam em `src/main/resources/application.properties`; variáveis `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CORS_ORIGINS` e `SPRING_PROFILES_ACTIVE` podem ser definidas no ambiente. `JWT_SECRET` precisa ter pelo menos 32 bytes. Para mudar o esquema, crie uma migration com versão posterior à `V13`; não edite migrations já aplicadas. Hibernate usa `ddl-auto=validate` e Flyway não executa `clean`.

Consulte `docs/DECISOES.md` para decisões de implementação.

Para testar a API pelo Bruno, abra a coleção [bruno](bruno/README.md) e siga o fluxo descrito nela.

Para implementar as interfaces do tablet e da equipe, consulte o [guia completo da API](docs/docs.md), com todos os endpoints, formatos JSON, regras de negócio e fluxos de tela.
