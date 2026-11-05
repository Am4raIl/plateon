# Decisões

- Pacote Java existente `japones.dev.plateon` mantido; a especificação descreve outro pacote, mas o projeto inicial já foi gerado com este.
- Java de compilação ajustado para 21. Spring Boot 4.1.2 mantido. Springdoc 3.2.0 acompanha o Boot 4.1.2.
- Testcontainers 2 usa o artefato `org.testcontainers:testcontainers-mysql`; o antigo `org.testcontainers:mysql` não é gerenciado pelo Boot 4.
- MySQL 8.4; UUID em `CHAR(36)`; colunas geradas no lugar de índices parciais; migrations forward-only.
- Sem Lombok, sem cache de token, sem refresh JWT e sem gateway de pagamentos.
- SSE usa Bearer no header Authorization e `fetch` streaming; emissores ficam em memória numa instância.
- Envio idempotente pelo estado do pedido, sem tabela extra.
- Rate limit em memória por IP. Imagens por URL. Taxa e couvert fixados na abertura da comanda.
- Troco é calculado e não persistido. Taxa e pagamentos contam no dia operacional do fechamento.
- Logs com MDC e Actuator health/info. Seeds usam chave natural e não usam factories.
- A lista de produtos da seção 4 soma 43 entradas, embora o texto diga 40. O seed inclui as 43 entradas listadas.
- O token aprovado fica apenas na memória até o primeiro polling. Se o processo reiniciar nesse intervalo, o tablet precisa solicitar novo pareamento; o banco conserva apenas SHA-256.
- No MySQL, `INSERT IGNORE` seguido de `SELECT FOR UPDATE` pode causar deadlock sob concorrência. O envio repete a transação inteira após rollback, preservando o número diário sem lacunas.
- `vendasPorHora` do dashboard converte o `DATETIME(6)` UTC para o fuso do restaurante via `CONVERT_TZ`; o contêiner MySQL 8.4 usado no teste possui dados de fuso.
- A URL JDBC usa `connectionTimeZone=UTC` para que o driver grave e leia `DATETIME(6)` em UTC, inclusive nos testes com banco externo.
- O Plateon escuta na porta 8081 por padrão (`SERVER_PORT` pode sobrescrever), pois o Catapult já usa a porta 8080 neste computador.
- `totalVendido` no dashboard soma itens de pedidos não cancelados; taxa de serviço e couvert aparecem no ticket da comanda e a taxa tem campo próprio. Esta definição evita contar a taxa duas vezes.
