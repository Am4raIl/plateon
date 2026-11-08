# Verificação da implementação — registro histórico

Esta é a fotografia da validação executada em 07/11/2026, com Node 24.14.0, Next.js 16.4.5, React 19 e Chromium do Playwright. Os números abaixo registram aquela execução; para o estado atual, rode os comandos do [README do frontend](../README.md). Os testes utilizam os contratos MSW e o servidor HTTP local de teste, sem alterar o backend ou banco reais.

## Resultados

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | Sem erros de TypeScript |
| `npm run lint` | Sem erros ou avisos de lint |
| `npm test` | 52 testes aprovados em 7 arquivos |
| `npm run e2e` | 20 cenários aprovados, incluindo duas sessões interagindo |
| Teclado no Kanban | Cancelar arraste, avançar, abrir detalhes, entregar; também aprovado em três execuções consecutivas |
| Mouse no Kanban | Avançar um passo e rejeitar salto de etapas; também aprovado em três execuções consecutivas |
| Toque no Kanban | Long press na alça, destino confirmado e alteração do pedido |
| axe | Login, dashboard, Kanban e cardápio sem violações nas regras WCAG A/AA verificadas, com movimento reduzido |
| Responsividade | Tablet 1280 × 800, desktop 1440 e celular 390 × 844; celular sem rolagem horizontal da página |
| Revisão de capturas | Cardápio e chamados conferidos visualmente; marca, cores, hierarquia e dimensões aplicadas a partir da Parte B |
| `npm run build` | Build de produção gerado em `.next/` |
| Conteúdo de produção | Sem tokens de teste, senha de demonstração, fixture Tagliatelle ou código `setupWorker` nos bundles |
| `git diff --check` | Sem erros de whitespace |

Após os ajustes finais de apresentação (esgotados e ordem da navegação móvel), os dois cenários de tablet/celular e a acessibilidade do cardápio foram repetidos com sucesso.

Na migração para Next.js, os 52 testes unitários passaram, o build e o TypeScript passaram, e os 20 cenários de navegador passaram (18 na primeira execução e os dois restantes após ajustes do indicador de desenvolvimento e do seletor de alerta). O navegador usa `/api/v1` no Next, que encaminha para o servidor de teste em 8082; o mesmo caminho usa o backend real em 8081 no desenvolvimento normal.

O modo antigo de mocks no navegador foi removido. Após novo build, os arquivos públicos em `.next/static` não contêm `dev12345678`, `dev-tablet-1`, `Tagliatelle` nem `setupWorker`. O cenário de pedido completo foi repetido com sucesso após essa remoção.

O Playwright gera `playwright-report/`, traces e capturas em `test-results/` (ignorados no Git). Capturas explícitas: `cardapio-tablet.png` e `chamados-mobile.png`. Para reproduzir todos os resultados, execute os comandos do README. Os servidores de teste são encerrados automaticamente.

## Matriz por tela

Todas as rotas abaixo utilizam dados da API configurada. Fixtures são restritas ao desenvolvimento/teste. Carregamento, vazio, erro com próxima ação e estados de sessão/permissão são tratados nos componentes compartilhados e nos fluxos específicos.

| Design | Rotas e implementação | Verificação realizada |
|---|---|---|
| T1–T2 | `/mesa/pareamento`: criação, validade, consulta, consumo único e nova solicitação | E2E de pareamento entre sessões e código vencido; unidade de token consumido uma vez |
| T3 | `/mesa/boas-vindas`: identificação da mesa pelo token | E2E de entrada, revogação e retorno ao pareamento |
| T4–T5 | `/mesa/cardapio`, `/mesa/produto/:id`: categorias, busca local, esgotados, adicionais, quantidade, observação e prévia | E2E de pedido completo, axe e captura 1280 × 800 |
| T6 | `/mesa/rascunho`: editar item completo, stepper, remover, observação geral, envio e expiração | E2E de envio e nova tentativa; integração de criação, adição e envio idempotente |
| T7 | `/mesa/pedido-enviado/:id`: itens e trilha derivados da comanda e SSE | E2E de cozinha avançando até entregue e tablet refletindo a atualização |
| T8–T9 | `/mesa/comanda`, `/mesa/aguardando-pagamento`: pedidos, totais do servidor, chamados e bloqueio financeiro | E2E de chamado e fechamento; integração do bloqueio de rascunhos |
| T10 | `/mesa/encerramento`: agradecimento, descarte da conta anterior e retorno ao pareamento em oito segundos | A implementação atual limpa o token revogado após o pagamento; a validação histórica não substitui teste com backend real |
| E1 | `/equipe/login`: validação, papel, expiração, limite de tentativas e retorno ao destino | E2E de login por papel, 401, 429 e acesso direto negado |
| E2–E3 | `/equipe/pedidos`: três colunas, estação, versão, cancelamento/retrocesso, detalhes, atraso, SSE, FLIP, mouse/toque/teclado | E2E de produção, conflito, teclado, mouse, toque e axe; unidade de permissões, transições e movimento do pedido inteiro |
| E4 | `/equipe/chamados`: polling, tempo decorrido, abas, paginação, atendimento otimista e restauração em falha | E2E de chamado/atendimento e viewport móvel; mesma política de erros e espera de alterações |
| E5 | `/equipe/tablets`: código, seletor do gerente/referência do garçom e aprovação | E2E de pareamento; adaptação de permissões documentada |
| C1 | `/equipe/comandas`, `/equipe/comandas/:id`: filtros, resumos paginados, conta completa, abertura e retrocesso de entregue pelo garçom ou gerente | E2E de consulta e entrada no fechamento; guardas por papel |
| C2 | `/equipe/comandas/:id/fechar`: taxa, preparar fechamento, pagamentos somados, dinheiro recebido, troco, pendências e força | E2E de dinheiro/troco, bloqueio de força para garçom e confirmação do gerente; unidade de soma em centavos e integração de total exato/rollback |
| G1 | `/gerencia/dashboard`: dia operacional, indicadores fornecidos, gráfico com tabela e detalhamentos | E2E de navegação e axe; unidade de dia operacional, moeda e horário de São Paulo |
| G2 | `/gerencia/produtos`: filtros, paginação, criar/editar, disponibilidade e desativação | E2E completo do cadastro e alteração da disponibilidade |
| G3 | `/gerencia/dispositivos`: aprovação, conexão, nome/mesa e revogação confirmada | E2E de pareamento, navegação e revogação refletida no tablet |
| G4 | `/gerencia/usuarios`: criar/editar, papel, ativo, senha opcional e desativação | E2E de criação, redefinição de senha e desativação |
| G5 | `/gerencia/adicionais-mesas`: adicionais por categoria e mesas com número/capacidade/atividade | E2E de criação e desativação dos dois cadastros |
| S1–S2 | Componentes, mensagens, contratos e decisões em código/documentação | Testes de Button, Tag, Stepper, Modal, foco, Toast, máscara BRL, parser SSE e mapa de erros |

## Estados e regras conferidos

- Tokens separados, nenhum número/ID de mesa enviado pelo tablet, expiração de sessão e revogação do dispositivo.
- Leitura com resposta vazia, validação de respostas críticas, erros de rede e mensagens normalizadas sem detalhes técnicos.
- Rascunho único, envio idempotente e reenvio acionado pelo usuário, preservando o mesmo pedido.
- Conflito sem manter movimento confirmado; nova leitura antes de oferecer outra alteração. Eventos aguardam o término do arraste.
- Conta em fechamento bloqueia novos pedidos; avanços de pedidos continuam permitidos. Garçom e gerente podem retroceder com motivo antes do fechamento; só gerente força fechamento.
- Pagamentos em várias formas somam o total do servidor. Conferência em centavos, dinheiro recebido e troco; nenhum processamento financeiro eletrônico.
- Estados de carregamento, busca vazia, esgotado, erro de regra, expiração do código, rascunho ausente, reconexão, acesso negado, sessão expirada, limite de tentativas e confirmação de sucesso implementados.
- Modal prende e devolve foco, fecha por Esc e torna o fundo inerte. Segmentados usam setas; stepper anuncia quantidade; status têm símbolo e texto; movimento reduzido é respeitado.

## Limites da homologação

Na execução de 07/11/2026, o backend em `localhost:8081` e seu OpenAPI não estavam disponíveis no ambiente de teste. A implementação foi confrontada com a documentação e o código Java local, mas a homologação com banco e credenciais reais não foi coberta por essa execução.

Não foram executadas leitura com um leitor de tela dedicado nem comparação pixel a pixel com artboards externos, que não foram fornecidos. A auditoria automática e a revisão de capturas não substituem essas etapas. As restrições de informação da API (mesas do garçom, estado financeiro da cozinha e minutos excedentes de atraso) estão em [DIVERGENCIAS.md](DIVERGENCIAS.md).
