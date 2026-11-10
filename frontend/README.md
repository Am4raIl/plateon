# Plateon · frontend

Aplicação para tablet fixo, cozinha/bar, garçom e gerência. O [guia da API](../backend/docs/docs.md) descreve o contrato atual; o [brief original](docs/GERACAO_FRONTEND.md) registra as decisões visuais iniciais. A interface, o diretório e o backend usam a marca **Plateon**.

## Executar

Para subir frontend, API e banco juntos com Docker, use o [Compose da raiz](../README.md).

Node.js 20.9+ e npm. Validado com Node 24.14.0. Inicie o backend na porta 8081 antes do frontend.

```powershell
npm ci
npm run dev
```

Abra **http://127.0.0.1:3000**. O Next.js encaminha `/api/v1/*` para `http://localhost:8081/api/v1/*`; navegador, chamadas HTTP, SSE e imagens usam a mesma origem. Não é preciso configurar CORS no backend para esse uso. O frontend não inicia nem modifica o banco; siga o [README do backend](../backend/README.md).

Para testar num tablet físico, execute `npm run dev -- --hostname 0.0.0.0`, acesse `http://IP-DO-COMPUTADOR:3000` e mantenha o backend acessível ao servidor Next neste computador. O tablet continua chamando apenas o Next. Reinicie o Next ao mudar variáveis. A distribuição final deve usar HTTPS.

Se o backend tiver outra origem, crie `.env.local` a partir de `.env.example` e altere `PLATEON_API_ORIGIN`; ela é usada somente no servidor Next. A origem padrão é `http://localhost:8081`.

## Rotas e fluxos

| Área | Entrada / telas |
|---|---|
| Início | `/` |
| Tablet | `/mesa/pareamento`, `/mesa/boas-vindas`, `/mesa/cardapio`, `/mesa/produto/:id` |
| Pedido e conta | `/mesa/rascunho`, `/mesa/pedido-enviado/:id`, `/mesa/comanda`, `/mesa/aguardando-pagamento`, `/mesa/encerramento` |
| Equipe | `/equipe/login`, `/equipe/pedidos`, `/equipe/chamados`, `/equipe/tablets` |
| Comandas e recebimento | `/equipe/comandas`, `/equipe/comandas/:id`, `/equipe/comandas/:id/fechar` |
| Gerência | `/gerencia/dashboard`, `/gerencia/produtos`, `/gerencia/adicionais-mesas`, `/gerencia/usuarios`, `/gerencia/dispositivos`, `/gerencia/couvert` |

Os menus e guardas seguem o papel retornado no login. Bar é uma estação. Garçom e gerente recebem pagamentos e podem retroceder pedidos com motivo; só o gerente força o fechamento. Pedir a conta cria um chamado. A conta paga revoga o pareamento do tablet da mesa, que volta à tela de pareamento. Pagamentos são registros de valores confirmados externamente. A gerência cadastra mesas e funcionários e define o couvert para as próximas comandas.

Para parear, abra `/mesa/pareamento` no tablet sem token. O garçom ou gerente abre **Tablets**, informa o código e escolhe uma mesa ativa. Na mesma tela, pode desparear o tablet atual para liberar a mesa. O tablet recebe o token uma única vez e abre as boas-vindas. Para abrir uma comanda, o garçom também escolhe a mesa pelo número. Veja [DIVERGENCIAS.md](docs/DIVERGENCIAS.md).

## Integração

- Bearers separados: equipe em `sessionStorage`/memória, tablet em `localStorage`/memória. Tokens nunca aparecem na interface. Trocar sessão descarta o respectivo cache.
- Totais, preços finais e taxa vêm do servidor. Zod valida respostas monetárias críticas. Apenas a seleção de produto mostra uma prévia; pagamentos são conferidos em centavos.
- Timeout de 15 s; repetição automática de GET para rede/servidor e espera por `Retry-After`. Escritas não são repetidas por falha de rede. Reenvio do pedido usa o mesmo ID.
- SSE com `fetch` e Bearer, parser incremental, reconexão progressiva e nova leitura HTTP. Eventos aguardam o fim do arraste. Sem conexão, o Kanban mantém os dados e bloqueia alterações.
- O Kanban também relê o quadro a cada 15 segundos para atualizar minutos e atrasos mesmo quando não há novos eventos; essa leitura pausa durante arraste e alteração.
- Chamados atualizam a cada 10 s, pausando com a aba oculta. Estado e conta do tablet também têm polling e acompanhamento dos pedidos ativos por SSE.
- Após o pagamento, o backend revoga o token do tablet. A tela de encerramento limpa os dados da conta anterior e retorna ao pareamento em oito segundos.

## Verificações e build

```powershell
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run e2e
npm run build
npm run start
```

`npm run test:watch` acompanha testes; `npm run format` formata o código. O build fica em `.next/` e precisa de um servidor Next (`npm run start`).

Vitest, Testing Library e MSW cobrem contratos, regras e componentes. Playwright inicia Next na porta **3000** e um servidor HTTP na **8082** que compartilha os contratos MSW entre as sessões; encerra ambos ao terminar. A suíte não altera o backend real. Mantenha essas portas livres.

Para fixtures manuais compartilhadas entre navegadores, execute `npx tsx e2e/mock-api.ts`, defina `PLATEON_API_ORIGIN=http://127.0.0.1:8082` em `.env.local` e reinicie o Next. Somente nesse servidor de teste, usuários contendo `cozinha`, `garcom` ou `gerente` assumem o papel correspondente, com senha `dev12345678`.

Em produção, configure `PLATEON_API_ORIGIN` no servidor Next. Os mocks ficam fora do aplicativo e não há dados de demonstração como fallback de rede.

## Estrutura

`app/` contém o layout e a rota Next que hospeda as telas interativas; `src/app` preserva as rotas de negócio, sessão e permissões no React Router; `src/api`, clientes e schemas; `src/design`, tokens e componentes; `src/features/{tablet,equipe,comandas,gerencia}`, as áreas do produto; `src/lib`, formatadores e SSE; `src/test/mocks` e `e2e`, os testes.

Decisões: [DIVERGENCIAS.md](docs/DIVERGENCIAS.md). Matriz por tela e resultados: [VALIDACAO.md](docs/VALIDACAO.md).
