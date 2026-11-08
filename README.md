# Plateon

Sistema de gestão de pedidos e atendimento para restaurantes.

O Plateon conecta o tablet disponível na mesa, a equipe do restaurante e a gerência em uma única aplicação. O cliente consulta o cardápio, monta e acompanha pedidos e solicita a conta pelo tablet. A equipe acompanha a produção em um quadro Kanban, atende chamados, administra comandas e registra pagamentos. A gerência configura mesas, produtos, adicionais, usuários, dispositivos e couvert.

## Para que serve

- tablet fixo para cada mesa;
- cardápio, pedidos e acompanhamento pela cozinha e pelo bar;
- chamados de garçom e solicitação de conta;
- comandas, taxas, couvert e pagamentos;
- cadastro de mesas, produtos, adicionais, usuários e tablets;
- autenticação por função e atualização em tempo real.

## Tecnologias

- **Frontend:** Next.js, React, TypeScript, React Router, React Query, Zustand e Zod.
- **Backend:** Java 21, Spring Boot, Spring Security, JWT, MySQL 8.4, Flyway e Maven.
- **Testes:** Vitest, Testing Library, MSW, Playwright, Testcontainers e JaCoCo.
- **Infraestrutura:** Docker Compose, com containers separados para frontend, API e banco.

## Como executar com Docker

### Pré-requisitos

Instale o Docker Engine com o plugin Docker Compose e deixe as portas \`3000\` e \`8081\` livres.

Na raiz do projeto, copie a configuração de ambiente:

\`\`\`powershell
Copy-Item .env.example .env
\`\`\`

Abra \`.env\` e defina \`JWT_SECRET\` com pelo menos 32 caracteres, além de \`ADMIN_USERNAME\` e \`ADMIN_PASSWORD\`.

Inicie o sistema:

\`\`\`powershell
docker compose up --build -d
\`\`\`

Esse comando cria as imagens e inicia MySQL, API e frontend em segundo plano. As migrations do Flyway são aplicadas automaticamente.

Para acompanhar a inicialização:

\`\`\`powershell
docker compose logs -f app frontend
\`\`\`

Acesse:

- Aplicação: <http://localhost:3000>
- API: <http://localhost:8081>
- Health check: <http://localhost:8081/actuator/health>

Para parar preservando os dados:

\`\`\`powershell
docker compose down
\`\`\`

Para remover também os volumes do banco e das imagens:

\`\`\`powershell
docker compose down -v
\`\`\`

> \`down -v\` apaga os dados persistidos. Use-o apenas para recriar o banco do zero.

Para criar dados de demonstração, adicione \`SPRING_PROFILES_ACTIVE=dev\` ao \`.env\`. Esse perfil é somente para desenvolvimento.

## Como executar sem Docker

Instale Node.js 20.9+, Java 21, MySQL 8.4 e Git. Crie um banco chamado \`pedidos_mesa\` e um usuário com acesso a ele.

### 1. Configurar a API

Na pasta \`backend\`, configure as variáveis:

\`\`\`powershell
$env:DB_URL="jdbc:mysql://localhost:3306/pedidos_mesa?connectionTimeZone=UTC"
$env:DB_USERNAME="plateon"
$env:DB_PASSWORD="plateon"
$env:JWT_SECRET="uma-chave-local-com-pelo-menos-32-caracteres"
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="uma-senha-local-forte"
\`\`\`

Elas informam à API como acessar o banco e quais credenciais usar para o administrador inicial.

### 2. Iniciar a API

\`\`\`powershell
Set-Location backend
.\mvnw.cmd spring-boot:run
\`\`\`

O comando instala dependências, aplica as migrations e inicia a API na porta \`8081\`. Mantenha o terminal aberto.

### 3. Iniciar o frontend

Em outro terminal, na raiz do projeto:

\`\`\`powershell
Set-Location frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
\`\`\`

\`npm ci\` instala as dependências do lockfile. \`npm run dev\` inicia o Next.js na porta \`3000\` e encaminha \`/api/v1\` para a API local.

Acesse <http://localhost:3000>. Para testar em um tablet na mesma rede:

\`\`\`powershell
npm run dev -- --hostname 0.0.0.0
\`\`\`

Depois, abra \`http://IP-DO-COMPUTADOR:3000\` no tablet.

## Comandos de desenvolvimento

Na pasta \`frontend\`:

\`\`\`powershell
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run e2e
npm run build
npm run start
\`\`\`

Os comandos verificam tipos, lint, testes unitários, testes de navegador e build de produção.

Na pasta \`backend\`:

\`\`\`powershell
.\mvnw.cmd test
\`\`\`

Os testes unitários não precisam de Docker. Os testes de integração precisam de um MySQL 8.4 acessível ou de um Docker Engine para o Testcontainers.

## Estrutura de pastas

\`\`\`text
plateon/
├── backend/
│   ├── src/main/java/       Código da API Spring Boot
│   ├── src/main/resources/  Configurações e migrations Flyway
│   ├── src/test/            Testes unitários e de integração
│   ├── docs/                Documentação da API
│   └── compose.yaml         Compose legado da API e do banco
├── frontend/
│   ├── app/                 Entrada do Next.js
│   ├── src/api/             Cliente HTTP, tipos e hooks
│   ├── src/app/             Rotas, sessão e permissões
│   ├── src/design/          Tokens, estilos e componentes
│   ├── src/features/        Funcionalidades do produto
│   ├── src/lib/             Utilitários e SSE
│   ├── src/test/            Mocks e configuração de testes
│   ├── e2e/                 Testes completos no navegador
│   └── docs/                Documentação do frontend
├── compose.yaml              Compose principal
├── .env.example              Variáveis de ambiente
└── README.md                 Este documento
\`\`\`

## Acessos e funções

- \`GARCOM\`: mesas, pedidos, chamados, comandas e recebimento;
- \`COZINHA\`: acompanhamento e avanço dos pedidos;
- \`GERENTE\`: administração completa e operações elevadas;
- \`TABLET\`: acesso restrito ao tablet pareado.

No perfil \`dev\`, a senha dos usuários de demonstração é \`dev12345678\`. Não use essas credenciais fora do ambiente local.

## Documentação complementar

- [Documentação da API](backend/docs/docs.md)
- [README do backend](backend/README.md)
- [README do frontend](frontend/README.md)
- [Validação do frontend](frontend/docs/VALIDACAO.md)
- [Divergências de implementação](frontend/docs/DIVERGENCIAS.md)

## Licença

Projeto desenvolvido para fins de estudo e demonstração.
