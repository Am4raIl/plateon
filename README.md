# Plateon com Docker Compose

O Compose da raiz sobe MySQL 8.4, API Spring Boot e frontend Next.js. Requer Docker Engine com o plugin Compose e as portas 3000 e 8081 livres.

Na primeira execução, copie `.env.example` para `.env` e substitua `JWT_SECRET` (pelo menos 32 caracteres) e `ADMIN_PASSWORD` por valores próprios. Defina `DB_PASSWORD` e `MYSQL_ROOT_PASSWORD` antes da primeira inicialização do banco; depois de criado o volume, mudar essas variáveis não altera as senhas já gravadas nele.

```powershell
Copy-Item .env.example .env
# Edite .env
docker compose up --build -d
```

Nas próximas execuções, basta `docker compose up -d`. Abra o sistema em **http://localhost:3000**. A API fica em **http://localhost:8081** e o health check em **http://localhost:8081/actuator/health**. Para acompanhar a inicialização, use `docker compose logs -f app frontend`; a primeira subida pode demorar enquanto o MySQL inicia e o Flyway aplica as migrations.

O Next encaminha `/api/v1/*` para a API pela rede interna do Compose. O navegador só precisa acessar a porta 3000. Em um tablet na mesma rede, use `http://IP-DO-SERVIDOR:3000`; para uso fora de uma rede confiável, publique o frontend com HTTPS. O banco não publica porta no host. Dados do banco e imagens de produtos ficam nos volumes `plateon_mysql_data` e `plateon_product_images`. `docker compose down` preserva ambos; `docker compose down -v` apaga os dados.

Para criar os dados de demonstração, defina `SPRING_PROFILES_ACTIVE=dev` no `.env` antes de iniciar. Não use esse perfil em uma instalação real.

O Compose antigo em `backend/compose.yaml` continua disponível para rodar apenas a API e o banco. Ele usa volumes de outro projeto Compose; os dados existentes nele não são migrados automaticamente para os volumes da raiz. Se ele estiver em execução, encerre-o antes de subir o Compose da raiz para liberar a porta 8081.

Para desenvolvimento local, veja [frontend/README.md](frontend/README.md) e [backend/README.md](backend/README.md).
