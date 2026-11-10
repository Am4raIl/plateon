# 🚀 Plateon — Gestão de Pedidos para Restaurantes

<p align="center">
  <img src="https://img.shields.io/badge/Java_21-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 21" />
  <img src="https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MySQL_8.4-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL 8.4" />
  <img src="https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Compose" />
</p>

---

O **Plateon** é um sistema de atendimento para restaurantes que integra tablets nas mesas, pedidos, cozinha, equipe e gerência. O cliente consulta o cardápio, envia pedidos e solicita a conta pelo tablet. A equipe acompanha a produção em um Kanban, atende chamados e administra comandas e pagamentos. A gerência configura mesas, produtos, usuários, dispositivos e couvert.

## ✨ Funcionalidades

- **Tablet na mesa:** pareamento, cardápio, pedidos, acompanhamento e solicitação de conta.
- **Produção:** Kanban para cozinha e bar, atualização em tempo real e controle de status.
- **Atendimento:** chamados de garçom, comandas, taxas, couvert, recebimento e reabertura controlada.
- **Gerência:** cadastro de mesas, produtos, adicionais, usuários e dispositivos.
- **Segurança:** autenticação JWT e permissões por função.
- **Testes:** testes unitários, integração e fluxos completos no navegador.

## 🛠️ Stack tecnológica

| Camada | Tecnologias |
| --- | --- |
| API | Java 21, Spring Boot, Spring Security, JWT e Flyway |
| Web | Next.js, React, TypeScript, React Router, React Query e Zustand |
| Dados | MySQL 8.4 |
| Testes | Vitest, Testing Library, MSW, Playwright e Testcontainers |
| Infraestrutura | Docker Compose, Maven e volumes persistentes |

## 📁 Estrutura do projeto

~~~text
plateon/
├── compose.yaml       # MySQL, API e frontend
├── backend/           # API Spring Boot, migrations e testes
└── frontend/          # Aplicação Next.js, funcionalidades e testes E2E
~~~

## ✅ Pré-requisitos

- **Docker:** Docker Desktop (Windows) ou Docker Engine + Compose (Linux).
- **Execução local:** Java 21, Node.js 20.9+, npm e MySQL 8.4.
- **Portas:** 3000 para o frontend e 8081 para a API.

## 🚀 Rodando pela primeira vez

### Com Docker Compose

Na raiz do repositório, crie o arquivo de ambiente:

~~~powershell
Copy-Item .env.example .env
~~~

Os valores do `.env.example` já permitem executar o ambiente local. O usuário
inicial é `admin` e a senha padrão é `admin12345678`. Troque essas credenciais
antes de expor a aplicação ou usar dados reais.

Para criar as imagens e iniciar todos os serviços:

~~~powershell
docker compose up --build -d
~~~

Use esse comando na primeira execução ou quando alterar o Dockerfile ou as dependências da imagem.

Para desenvolver com atualização automática, inicie uma vez com:

~~~powershell
docker compose -f compose.yaml -f compose.dev.yaml up --build
~~~

Enquanto os containers estiverem ativos, o Next atualiza a interface ao salvar arquivos do frontend. O container da API observa `backend/src` e `backend/pom.xml`, recompila e reinicia a aplicação após alterações. Não é necessário repetir o comando após cada alteração. Para encerrar, pressione `Ctrl+C` e execute `docker compose -f compose.yaml -f compose.dev.yaml down` se quiser parar os serviços.

Se usar Podman, substitua `docker compose` por `podman compose` nos comandos acima. O `podman-compose` não aceita `--watch`; use o comando de desenvolvimento mostrado acima sem essa opção. A recarga automática já ocorre dentro dos containers.

| Serviço | Endereço |
| --- | --- |
| Aplicação web | <http://localhost:3000> |
| API | <http://localhost:8081> |
| Health check | <http://localhost:8081/actuator/health> |

Depois que as imagens já existirem, inicie os containers sem reconstruí-las:

~~~powershell
docker compose up -d
~~~

Para acompanhar os logs da API e do frontend:

~~~powershell
docker compose logs -f app frontend
~~~

Para parar os containers preservando os volumes e os dados:

~~~powershell
docker compose down
~~~

Para parar os containers e apagar também os volumes persistentes:

~~~powershell
docker compose down -v
~~~

> Use `down -v` somente quando quiser apagar os dados do banco e as imagens de produtos armazenadas nos volumes.

Para criar dados de demonstração, adicione `SPRING_PROFILES_ACTIVE=dev` ao `.env`.
Esse perfil e as credenciais padrão são destinados somente ao desenvolvimento.

### Windows — sem Docker

~~~powershell
mysql -u root -p
~~~

~~~sql
CREATE DATABASE pedidos_mesa;
CREATE USER 'plateon'@'localhost' IDENTIFIED BY 'plateon';
GRANT ALL PRIVILEGES ON pedidos_mesa.* TO 'plateon'@'localhost';
FLUSH PRIVILEGES;
EXIT;
~~~

Crie o banco pedidos_mesa no MySQL e configure as variáveis da API na pasta backend:

~~~powershell
$env:DB_URL="jdbc:mysql://localhost:3306/pedidos_mesa?connectionTimeZone=UTC"
$env:DB_USERNAME="plateon"
$env:DB_PASSWORD="plateon"
$env:JWT_SECRET="uma-chave-local-com-pelo-menos-32-caracteres"
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="uma-senha-local-forte"
~~~

Inicie a API:

~~~powershell
cd backend
.\mvnw.cmd spring-boot:run
~~~

Em outro terminal, instale as dependências e inicie o frontend:

~~~powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
~~~

Acesse <http://localhost:3000>. Para testar em um tablet na mesma rede, use `npm run dev -- --hostname 0.0.0.0` e abra `http://IP-DO-COMPUTADOR:3000`.

### Linux — sem Docker

Crie o banco MySQL e um usuário local, como no exemplo da seção Windows. Defina `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_USERNAME` e `ADMIN_PASSWORD` no ambiente antes de iniciar a API:

~~~bash
cd backend
./mvnw spring-boot:run
~~~

Em outro terminal:

~~~bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
~~~

Acesse <http://localhost:3000>.

## 🔑 Credenciais de demonstração

Quando o perfil dev estiver ativo:

| Usuário | Senha | Ambiente |
| --- | --- | --- |
| dev_cozinha_1 | dev12345678 | Desenvolvimento |
| dev_garcom_1 | dev12345678 | Desenvolvimento |
| dev_gerente_1 | dev12345678 | Desenvolvimento |

Não use essas credenciais fora do ambiente local.

## 🧪 Verificações

Na pasta frontend:

~~~powershell
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run e2e
npm run build
~~~

Na pasta backend:

~~~powershell
.\mvnw.cmd test
~~~

Os testes de integração do backend precisam de um MySQL 8.4 acessível ou de um Docker Engine para o Testcontainers.

## 📚 Documentação

- [Documentação da API](backend/docs/docs.md)
- [README do backend](backend/README.md)
- [README do frontend](frontend/README.md)
- [Validação do frontend](frontend/docs/VALIDACAO.md)
- [Divergências de implementação](frontend/docs/DIVERGENCIAS.md)
- [Coleção Bruno](backend/bruno/README.md)

Arquivos `.env`, ambientes locais do Bruno, chaves e certificados são ignorados pelo Git. Versione apenas os arquivos `.example` sem valores privados. As credenciais padrão e de demonstração deste repositório são públicas e servem apenas para desenvolvimento local; substitua-as antes de expor os serviços.

## 📄 Licença

Projeto desenvolvido para fins de estudo e demonstração.
