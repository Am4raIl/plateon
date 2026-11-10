# PLATEON — brief original de implementação do frontend

> Registro histórico do design inicial, mantido como referência visual. Algumas rotas, papéis e fluxos abaixo foram substituídos durante a implementação. Para o comportamento atual, consulte o [README](../README.md), as [divergências](DIVERGENCIAS.md), o [contrato da API](../../backend/docs/docs.md) e o código.

Você é um engenheiro frontend sênior responsável por implementar o **Plateon**, software de restaurante com tablets fixos nas mesas e interfaces para cozinha, bar, garçons, caixa e gerência. Entregue o frontend de produção completo, funcionando contra a API real, **idêntico ao design descrito neste documento**, com todas as telas, fluxos, estados, mensagens/toasts e animações funcionando.

Este documento contém TUDO de que você precisa do design: a síntese completa está na Parte B (tokens, telas, copy, dados de exemplo, Kanban). Não depende de nenhum link externo. A única fonte externa é a documentação da API.

---

# PARTE A — INSTRUÇÕES

## 1. Fontes de verdade (leia ANTES de escrever código)
1. A documentação da API (docs/docs.md, "Plateon: guia de integração para o frontend") é a fonte de verdade para dados, permissões e regras. Se houver diferença, vale o OpenAPI da versão em execução (http://localhost:8081/v3/api-docs). A marca na documentação e na interface é sempre **"Plateon"**.
2. A síntese do design (Parte B deste documento) é a fonte de verdade para visual, copy, layout e fluxo. Se algo estiver ambíguo, escolha a opção mais simples coerente com a identidade e registre em docs/DIVERGENCIAS.md.
3. Precedência: API/docs > design (Parte B) > sua preferência. Quando design e API divergirem, siga a API e registre em docs/DIVERGENCIAS.md. Nunca invente funcionalidade que a API não sustenta.

## 2. Regras inegociáveis
- Tablet fixo: sem cadastro de cliente, sem escolher mesa. A mesa vem do token do dispositivo; NUNCA envie mesaId ou numeroMesa em /mesa/**.
- Sem QR code, estoque, impressão, upload de imagem, planta do salão, checkout online, geração de PIX ou integração com maquininha. Pagamento é só registro de confirmação externa.
- Múltiplas formas de pagamento somam o total da conta; não dividem por pessoa ou item.
- "Pedir a conta" cria um chamado do tipo CONTA e NÃO inicia o fechamento.
- Um pedido tem um único status para todo o pedido, mesmo misto (cozinha + bar). Sem status por item ou por estação.
- BAR é uma estação do Kanban, não um papel. Papéis: COZINHA, GARCOM, CAIXA, GERENTE.
- Sem promessa de funcionamento offline. Sem indicadores, comparações ou tendências que a API não fornece.
- Nunca exiba na interface tokens, UUIDs, endpoints, códigos HTTP ou mensagens técnicas. Todo texto visível em português do Brasil; valores em BRL (Intl.NumberFormat pt-BR); horários em America/Sao_Paulo; o dia operacional começa às 04:00.
- Valores monetários e totais vêm SEMPRE do servidor. Não recalcule preços, taxas ou totais; no máximo mostre uma prévia claramente marcada ao escolher adicionais e quantidade.
- Quem não pode uma ação não a vê (menu/botão ausente); mesmo assim, trate todo 403 como autoridade final.
- Fidelidade ao design é requisito, não sugestão: layout, tipografia, cores, espaçamentos, textos, ordem de ações e estados devem coincidir.

## 3. Stack e estrutura
- Next.js 16 + React 19 + TypeScript estrito. O App Router entrega a aplicação; React Router preserva a navegação interativa das áreas existentes. TanStack Query para dados do servidor. Zustand apenas para estado local de UI/sessão. Zod + react-hook-form para formulários e validação de respostas críticas. CSS com variáveis (tokens) e CSS Modules; sem biblioteca de UI pronta. Fontes: Fraunces e Source Sans 3 (Google Fonts, display=swap). Motion: CSS transitions/keyframes; @dnd-kit para o Kanban.
- Estrutura: src/app (rotas, providers), src/design (tokens.css, componentes base), src/features/{tablet,equipe,caixa,gerencia}, src/api (cliente, hooks, tipos), src/lib (formatadores, datas, sse). Um app, três áreas: /mesa/*, /equipe/*, /gerencia/*, com layouts distintos e componentes compartilhados.
- Variáveis de ambiente: `PLATEON_API_ORIGIN` no servidor Next (padrão `http://localhost:8081`). O navegador usa `/api/v1` pela origem do Next; não precisa de CORS no backend nesse fluxo.
- Tipos TypeScript para todas as views da documentação (ProdutoView, PedidoView, ComandaView, Kanban, FechamentoDiario etc.), enums em maiúsculas. IDs são strings UUID: nunca derive número de mesa a partir deles.
- Para desenvolvimento e testes, use MSW com fixtures fiéis aos formatos da doc; a aplicação final fala com a API real.

## 4. Cliente HTTP, autenticação e erros
- Dois Bearers independentes: JWT da equipe (POST /auth/login, 8 h, só /admin/**) e token do tablet (só /mesa/**). Dois clientes separados. Envie JSON com Content-Type application/json; NUNCA envie campos extras (a API responde 400).
- Token do tablet: obtido uma única vez no pareamento; guarde em localStorage (com try/catch) e nunca o exiba. JWT da equipe: sessionStorage/memória; ao sair, descarte (não existe logout no servidor). Ao expirar (401), limpe e vá ao login preservando a rota de origem.
- Normalize erros application/problem+json (type, title, status, detail; 409 inclui estadoAtual e transicoesPermitidas) em uma classe ApiError com mapa de mensagens em português:
  - 400: erro de campo/corpo; mostre validação no campo.
  - 401: equipe → "Sua sessão expirou" + login; tablet → limpar token e voltar ao pareamento.
  - 403: "Acesso negado" e ocultar a ação.
  - 404: item/pedido inexistente; no tablet, rascunho expirado → "Seu rascunho expirou" + criar outro; nunca exibir dados de outra mesa.
  - 409: recarregar o recurso e só então oferecer nova ação (conflito no Kanban, comanda aguardando pagamento, chamado já atendido).
  - 410: código de pareamento vencido → tela T2; gerar nova solicitação.
  - 422: regra de negócio (produto indisponível, adicional inválido, motivo ausente, soma de pagamentos) → mensagem na própria ação.
  - 429: leia Retry-After, desabilite o controle com contagem regressiva e tente de novo sozinho.
  - 500/rede: "Não conseguimos concluir agora. Nada foi alterado." + "Tentar de novo".
- Timeouts de 15 s; repetição automática só para GETs (backoff exponencial). NUNCA repita automaticamente POST/PATCH, exceto o reenvio idempotente do mesmo pedido, acionado pelo usuário.
- Dinheiro: números JSON em reais; formate com Intl (R$ 1.234,56) e tabular-nums. Instantes ISO em UTC: converta para America/Sao_Paulo.

## 5. Tempo real (SSE) com Bearer
- Rotas: GET /admin/kanban/eventos (JWT) e GET /mesa/pedidos/{pedidoId}/eventos (token do tablet). EventSource nativo não aceita header: use fetch + ReadableStream (ou @microsoft/fetch-event-source) com Authorization.
- Eventos: "conectado" e "pedido" ({pedidoId, status}); comentários :heartbeat (15 s) são ignorados. Não há snapshot, replay nem ids: ao conectar, reconectar ou receber "pedido", refaça a leitura HTTP (GET /admin/kanban ou GET /mesa/comanda) e reconcilie.
- Conexão dura no máximo 30 min: reconecte com backoff (1 s, 2 s, 4 s … até 30 s). 401/403 na reconexão: pare e refaça autenticação/pareamento. Feche o stream ao sair da tela ou trocar de usuário.
- Estado de conexão exposto à UI: conectado | reconectando | sem conexão; mostrado no Kanban e usado para desabilitar ações com aviso.
- Não há SSE para chamados: polling a cada 10 s (pausado com a aba oculta) e "Atualizado há N s".
- No tablet, durante o pareamento: polling ~3 s (cota de 60/min); PENDENTE mantém a tela; CONSUMIDA com token conclui; leia o token uma única vez.

## 6. Componentes (src/design/*, cada um com estados e testes)
- **Button**: primário (verde), secundário (contorno), fantasma, perigo (contorno erro), perigo-primário (preenchido erro); tamanhos xs/sm/md/lg; estados repouso, hover, foco visível, pressionado, desabilitado (motivo em texto próximo ou aria-describedby) e carregando (spinner + rótulo mantido, aria-busy, largura estável).
- **Tag/Status**: sempre texto + símbolo, nunca só cor (● Recebido, ◐ Em preparo, ✓ Pronto, ✓ Entregue, ✕ Cancelado, ✎ Rascunho com borda tracejada, ⊘ Esgotado agora, ● Online/Offline, ● Aberta). ATRASO é estado à parte: borda de 2 px, ▲ e minutos excedentes ("▲ Atrasado +3 min").
- **Input, Select, Textarea, Switch, Checkbox, Seg** (grupo segmentado, aria-pressed), **Stepper** (− n +, alvo 48 px, limites, aria-live no valor), **Money input** (máscara BRL, aceita vírgula). Label sempre visível; erro de campo em texto abaixo com ▲ e aria-describedby.
- **Banner** (ok/atenção/erro/info) com ícone textual e role status ou alert; **Toast**; **Tabela** (cabeçalho fixo, números à direita, linha selecionada, overflow horizontal); **Modal** e **Drawer** (foco preso, Esc fecha, devolve foco ao disparador, fundo inerte); **Foto placeholder** (bloco com tom de fundo e tom de comida, usado quando imagemUrl for nulo ou falhar); **Skeleton**; **EmptyState** (título, uma frase, próxima ação); **ErrorState** com "Tentar de novo".
- **Navegação**: barra do tablet (Cardápio, Rascunho com badge, Comanda com badge); lateral verde da gerência/caixa (seções Operação/Gerência); barra inferior do garçom (64 px, 4 itens, ativo com 3 px verde no topo).
- **Cartão e coluna do Kanban**: ver seção 15.

## 7. Toasts e mensagens
- Toast: canto inferior (desktop: direita; celular: acima da barra inferior), máx. 3 empilhados, 5 s (erro 8 s, com Fechar; pausa em hover/foco). sucesso/info = role=status (polite); erro = role=alert. Nunca roubam foco. Nunca são a única confirmação de ação destrutiva.
- Textos (pt-BR, curtos, sem exclamação): "Pedido Nº 14 enviado à cozinha."; "Rascunho atualizado."; "Item removido do rascunho." (sem "Desfazer": a API não tem); "Garçom chamado. Já estamos a caminho."; "Mesa 09 marcada como atendida."; "Pedido Nº 14 movido para Pronto."; "Este pedido foi alterado por outra pessoa." (409 no Kanban); "Tablet pareado com a Mesa 08."; "Conta fechada. Mesa 03 livre."; "Produto salvo.". Erros usam a tabela da seção 4. Nunca mostre stack, código ou JSON.
- Confirmações destrutivas (cancelar pedido, retroceder, revogar tablet, forçar fechamento) usam Modal com consequência escrita e botão nomeado pela ação ("Revogar tablet", nunca "OK").
- Estados obrigatórios por tela: carregando (skeleton), vazio, erro com retentativa, sem conexão (banner persistente), sem permissão, sucesso. Toda mensagem diz o que aconteceu e oferece um próximo passo. Cubra os 22 casos do catálogo (ver Parte B, seção B7).

## 8. Animações fluidas
- Somente transform e opacity (60 fps); não anime width/height/top/left, exceto acordeão por grid-template-rows.
- Entradas: toast sobe 8 px + fade 200 ms; modal fade 200 ms + escala .98→1; drawer desliza 240 ms; banner expande 200 ms; troca de rota fade 120 ms.
- Kanban: cartão que muda de coluna anima com FLIP (200 ms); evento de outra pessoa gera destaque curto (fundo verde-t que some em 1,2 s). Arraste: cartão levanta (sombra, sem rotação), origem vira espaço tracejado, destino permitido ganha contorno verde, bloqueado ganha hachura e cursor not-allowed.
- Tablet: ao adicionar item, o contador do Rascunho pulsa uma vez (scale 1.12, 200 ms); o stepper troca o número com deslize vertical curto; a trilha do pedido enviado preenche entre etapas.
- Spinner: anel 16/20 px, 700 ms linear, nunca bloqueia o resto da tela.
- prefers-reduced-motion: reduce → desligue transformações e pulsos; mantenha só fades ≤120 ms e mudanças de cor; arrastar continua funcional.

## 9. Acessibilidade (WCAG 2.2 AA)
- Contraste: texto ≥ 4,5:1; componentes/ícones ≥ 3:1 usando os pares dos tokens; latão #A88954 nunca como texto. Foco visível de 2 px verde + offset 2 em tudo que é interativo.
- Semântica: landmarks (header, nav, main), um h1 por tela, botões são `<button>`, links são `<a>`, tabelas com `<th scope>`. Imagens de prato com alt = nome; decorativas com alt vazio. lang="pt-BR".
- Status sempre texto + símbolo. Atualizações em tempo real anunciadas em região aria-live polite sem roubar foco (ex.: "Novo pedido Nº 18, Mesa 04").
- Teclado completo: Tab ordenado, Enter/Espaço ativam, Esc fecha overlays, setas nas abas e no seg; no Kanban, fluxo da seção 15.
- Alvos de toque: 48–60 px no tablet; 44 px na equipe/gerência; 8 px entre alvos. Zoom 200% sem perda; sem rolagem horizontal da página, exceto tabelas largas com overflow próprio. Formulários: rótulo visível, erro associado, autocomplete correto no login. Respeite prefers-reduced-motion e prefers-contrast.

## 10. Tablet da mesa (/mesa/*), 1280×800
Layout: barra superior (monograma + "Plateon" em Fraunces, divisor, "Mesa 07" em tabular, navegação Cardápio | Rascunho (badge) | Comanda (badge), botão secundário "Chamar garçom"). Sem token → /mesa/pareamento. Qualquer 401 → limpa token e volta ao pareamento.

- **T1 Pareamento** (/mesa/pareamento): ao abrir, POST /mesa/pareamento/solicitar. Código grande (ex.: ABC 234, tabular, espaçado), instrução "Peça a um garçom ou ao gerente para aprovar este código", validade de 10 min com contagem regressiva e ponto latão pulsando. Polling ~3 s em GET /mesa/pareamento/{id}: PENDENTE continua; CONSUMIDA com token → guarda e vai a T3. Nunca mostre o token.
- **T2 Código vencido**: 410 ou tempo esgotado → aviso, código anterior riscado, botão "Gerar novo código".
- **T3 Boas-vindas** (/mesa/boas-vindas): "Mesa 07" em destaque, botão grande "Ver o cardápio". Dados de mesa/comanda/taxa conforme a doc.
- **T4 Cardápio** (/mesa/cardapio): coluna esquerda de categorias numeradas (01 Entradas, 02 Porções, 03 Hambúrgueres, 04 Massas, 05 Pizzas, 06 Pratos principais, 07 Bebidas, 08 Sobremesas; a ativa com ponto latão). Título com filete ("04 MASSAS") + h1 Fraunces; busca "Buscar no cardápio" (filtro local por nome/descrição; a API não tem busca). Primeiro prato da categoria em destaque (foto 380×268, nome 38 px, descrição, preço 24 px, botão "Escolher →"); demais em linhas (foto 120×96, nome, descrição, preço, botão "Adicionar"). Indisponível: foto a 55%, texto mudo, tag "⊘ Esgotado agora", sem botão. Barra flutuante inferior quando há rascunho: tag tracejada "✎ Rascunho", "2 itens", total, "Ainda não enviado à cozinha.", botão "Revisar e enviar". Dados: GET /mesa/cardapio.
- **T5 Produto** (/mesa/produto/:id): foto grande, nome, descrição, adicionais (checkbox com preço; respeite máximos/obrigatoriedade da API), stepper de quantidade, "Observação" (limite da API), total, botão "Adicionar ao rascunho (R$ 83,00)" (o valor é prévia marcada; o servidor manda). Adicional inválido → 422 junto ao grupo.
- **T6 Rascunho** (/mesa/rascunho): itens editáveis com stepper, adicionais, observação geral, remover item, subtotal (ex.: R$ 108,00), aviso "Rascunhos expiram em 30 min sem alteração", botão "Enviar pedido" (desabilitado se vazio). Operações: rascunho e envio conforme a doc. Rascunho expirado (404/422) → "Seu rascunho expirou" + "Começar outro". Comanda AGUARDANDO_PAGAMENTO bloqueia novos rascunhos (T9).
- **T7 Pedido enviado** (/mesa/pedido-enviado/:id): "Pedido Nº 17 enviado", itens, trilha RECEBIDO → EM_PREPARO → PRONTO → ENTREGUE alimentada por SSE de /mesa/pedidos/{id}/eventos (+ refetch), botões "Voltar ao cardápio" e "Acompanhar pedidos". Estimativas só se a API trouxer.
- **T8 Comanda** (/mesa/comanda): pedidos com status (tag), itens e subtotais; taxa de serviço e couvert na conta; total (exemplo R$ 530,10 = 471,00 + 47,10 + 12,00). Ação principal "Pedir a conta" (chamado tipo CONTA; NÃO fecha). "Chamar garçom" na barra. Não há cancelar no tablet. A lista vem da comanda relida a cada evento (não há pedido individual no tablet).
- **T9 Aguardando pagamento**: total, pedidos em andamento, banner de conta em fechamento; novos pedidos desabilitados; leitura continua; ação "Chamar garçom".
- **T10 Encerramento**: comanda PAGA → "Conta paga", agradecimento sem dados pessoais, retorno automático em 8 s; botão "Voltar ao início".
- **Chamados**: "Chamar garçom" abre sheet com motivos (Garçom, Ajuda, Conta), envia, toast "Garçom chamado. Já estamos a caminho."; bloqueie repetição por alguns segundos; trate 409/429.

## 11. Equipe: login, navegação, garçom
- **E1 Login** (/equipe/login): marca, "Entrar", e-mail e senha (autocomplete), "Entrar", 401 "E-mail ou senha incorretos", 429 com contagem. POST /auth/login → JWT + papel. Rota inicial: COZINHA e GARCOM → Kanban; CAIXA → Comandas; GERENTE → Dashboard. Guardas por papel; item inexistente não aparece; acesso direto → "Acesso negado".
- **E4 Garçom — Chamados** (celular 390×844, /equipe/chamados): cabeçalho verde com monograma, "Chamados", "Ana · Garçom"; seg "Abertos (3) | Atendidos"; linha "Atualizado há 10 s · atualiza sozinho" com ponto; cartões: mesa em 34 px tabular, eyebrow "Mesa", tag "● Conta | Ajuda | Garçom", tempo aberto (acima de 10 min em erro e negrito), para Conta o texto "A mesa pediu a conta. O fechamento é iniciado no caixa.", botão primário "Marcar atendido" (otimista com rollback; 409 → "Outra pessoa já atendeu" e recarrega). Banner "Mesa 09 marcada como atendida." (role status). Barra inferior: Chamados (contagem), Pedidos, Comandas, Tablets. Polling 10 s.
- **E5 Garçom — Aprovar tablet** (/equipe/tablets): código, seletor de mesa, "Aprovar pareamento". 409: "Mesa 07 já tem um tablet ativo. Para pareá-la de novo, troque ou revogue o aparelho atual antes."; 410 código vencido; sucesso "Tablet pareado com a Mesa 08."

## 12. Caixa (/equipe/comandas), desktop 1440
Lateral verde com monograma + "Comandas" (contagem).
- **C1 Comandas**: abertas e aguardando pagamento (mesa, valor parcial, pedidos pendentes, tag). Filtro por situação, paginação (sem busca de texto). "Fechar conta" abre C2. "Cancelada" existe só para consulta.
- **C2 Fechar a conta** (/equipe/comandas/:id/fechar): título "Fechar a conta · Mesa 03" com tag "● Aberta".
  - 01 CONTA: "Subtotal (4 pedidos entregues)" R$ 286,00; "Taxa de serviço (10%)" R$ 28,60; "Couvert" R$ 12,00; "Total a receber" R$ 326,60 em 44 px verde. Switch "Remover taxa de serviço" ("Total passa para R$ 298,00. A taxa é zerada antes de calcular o total.") → removerTaxa=true. Banner ok "Todos os pedidos desta comanda estão entregues ou cancelados." Valores sempre do servidor; as prévias são marcadas.
  - 02 PAGAMENTOS RECEBIDOS: "Registre o que a equipe já confirmou na maquininha, no banco ou em mãos. O Plateon não cobra nem gera PIX. Várias formas somam o total da conta, não dividem por pessoa." Tabela Forma | Valor aplicado | Recebido | Troco | Remover (ex.: PIX R$ 200,00; Dinheiro R$ 126,60 recebido R$ 150,00 troco R$ 23,40). Formulário: seg Dinheiro/PIX/Crédito/Débito; "Valor aplicado à conta"; "Recebido em dinheiro" (só dinheiro; senão "Só para dinheiro"); "+ Adicionar"; "Restante a registrar". Resumo: total aplicado, restante, troco a devolver.
  - Confirmar: POST /admin/comandas/{id}/fechar com {pagamentos:[{forma,valor,valorRecebido?}], removerTaxa, forcar}. Botão "Confirmar recebimento e fechar" só habilita com restante R$ 0,00; 422 mantém os valores. Texto: "Ao fechar, a comanda vira Paga, a Mesa 03 volta a Livre e o tablet encerra a sessão. Se a soma não bater, nada é fechado e os valores permanecem para correção." Sucesso → toast "Conta fechada. Mesa 03 livre." e volta a C1. "Cancelar" volta sem salvar.
  - Iniciar AGUARDANDO_PAGAMENTO: ação separada com pagamentos=[]; bloqueia cancelar/retroceder pedidos e novos rascunhos (avançar continua permitido).
  - 03 PENDÊNCIAS (exemplo Mesa 07): banner erro "Não dá para fechar a Mesa 07 ainda. Há 3 pedidos em andamento: Nº 14 (em preparo), Nº 16 e Nº 17 (recebidos). Entregue ou cancele antes de fechar." + botão desabilitado; para CAIXA: "o fechamento forçado não existe: ele orienta a chamar o gerente". Só GERENTE vê o cartão "Somente gerente · fechamento forçado" (borda erro): checkbox "Fechar ignorando 3 pedidos em andamento", "Pedidos já cobrados continuam sendo preparados e entregues, mas não poderão ser cancelados nem retrocedidos. Rascunhos da mesa serão cancelados.", botão "Forçar fechamento" → forcar=true.

## 13. Gerência (/gerencia/*, só GERENTE), desktop 1440
Lateral verde: monograma + "Plateon"; seção "Operação" (Produção, Chamados com contagem, Comandas) e "Gerência" (Dashboard, Produtos, Adicionais e mesas, Usuários, Dispositivos); rodapé com nome e papel ("Diego · Gerente"). Cabeçalho de página: eyebrow + h1 Fraunces 34 px. Listas paginadas (page/size) com vazio e esqueleto. PATCH/PUT enviam o objeto COMPLETO conforme a doc e nunca campos extras; após salvar, invalide e recarregue.
- **G1 Dashboard**: fechamento do dia operacional (começa às 04:00 America/Sao_Paulo; escolha de data). Cartões: total vendido, pedidos, ticket médio, taxa de serviço; vendas por hora, por categoria, top 10 produtos, por forma de pagamento, tempos médios (preparo/entrega, minutos), atrasados, cancelados (quantidade e valor). Gráficos em SVG próprio, acessíveis, com tabela equivalente. Só indicadores que a API fornece.
- **G2 Produtos**: tabela (nome, categoria, preço, estação Cozinha/Bar, disponibilidade em switch com PATCH imediato e rollback); criar/editar em Drawer (nome, descrição, preço, categoria, estação, imagemUrl, adicionais permitidos); Zod. Imagem só por URL.
- **G3 Dispositivos**: tabela Dispositivo | Mesa | Conexão (● Online = acessou há menos de 2 min; Offline; Revogado) | Último acesso (relativo, "há 40 s") | Pareado em ("02/11 18:20") | Ações (Renomear, Trocar mesa, Revogar; revogado "Sem ações"). Nota: "Trocar a mesa vale na hora: o mesmo tablet passa a atender a nova mesa. Só existe um tablet ativo por mesa. Revogar faz o tablet pedir um novo pareamento." Painel "APROVAR TABLET": "Código mostrado no tablet", "Mesa" (seletor com lugares), "Aprovar pareamento", banner 409 "Mesa 07 já tem um tablet ativo…". Modal "Revogar “Tablet mesa 12”?": "O tablet perde o acesso agora e volta à tela de pareamento. A comanda e os pedidos da mesa não são afetados." Botões "Voltar" e "Revogar tablet". Sem busca de texto.
- **G4 Usuários**: nome, e-mail, papel, ativo; criar/editar, redefinir senha, desativar (trate o erro se o gerente tentar desativar a si mesmo).
- **G5 Adicionais e mesas**: CRUD de adicionais (nome, preço, ativo) e mesas (número, lugares, ativa) conforme a doc. Taxa e couvert são fixos na abertura da comanda (não editáveis por tela).

## 14. Permissões
Cozinha e garçom movem pedidos; só garçom e gerente atendem chamados e aprovam tablets; caixa e gerente fecham comandas; só o gerente força fechamento e acessa a gerência. Bar é estação do Kanban, não papel. A UI esconde o que o papel não pode; 403 é autoridade final.

## 15. Kanban (/equipe/pedidos), a tela mais importante
- **Dados**: GET /admin/kanban com filtro de estação (Todas | Cozinha | Bar) + SSE /admin/kanban/eventos. Três colunas fixas com contagens: Recebidos, Em preparo, Prontos. ENTREGUE sai do quadro (sem quarta coluna). Ordem fixa por horário de envio; ninguém reordena.
- **Barra superior** (referência 1180×820): seg de estação (Todas/Cozinha/Bar), indicador de conexão (ponto + estado), nome e papel. Sem conexão: quadro visível com banner e ações desabilitadas.
- **Cartão**: mesa em 30 px tabular, Nº do pedido, minutos decorridos; quantidades, itens, adicionais; observações em bloco destacado (nunca truncar); alça (grip) para arrastar; menu ⋯ (Ver pedido, Cancelar, Retroceder); botão primário por coluna: "Iniciar preparo" (RECEBIDO), "Marcar pronto" (EM_PREPARO), "Entregar à mesa" (PRONTO). Sem fotos. Pedido longo mostra 4 itens e abre o resto em Drawer lateral. Atrasado: borda 2 px, "▲ Atrasado +3 min" (exemplo Nº 14 Mesa 07, 28 min), só naquele cartão; o limite vem da API/config, não invente. Pedido misto (ex.: Nº 15 Mesa 11) aparece em cozinha e bar com um status único; ao arrastar: "Move cozinha e bar". Conta AGUARDANDO_PAGAMENTO: marca no cartão; avançar permitido; cancelar/retroceder bloqueados com motivo em texto.
- **Transições**: PATCH com {status, versao}. O botão é o caminho confiável; arrastar e teclado produzem a mesma ação. Um passo por vez, só para a direita (retroceder só pelo menu, nunca por arraste). Atualização otimista: cartão move com estado "pendente" (75% de opacidade + indicador); confirma na resposta; em falha volta ao lugar com animação e toast; em 409 recarrega o quadro e avisa "Este pedido foi alterado por outra pessoa." Se o pedido sai do quadro durante o arraste: "Este pedido saiu do quadro".
- **Permissões**:

| Ação | Quem | Motivo | Observação |
|---|---|---|---|
| Avançar um passo | Cozinha, garçom, gerente | Não | Permitido mesmo com conta aguardando pagamento |
| Entregar | Cozinha, garçom, gerente | Não | Botão ou faixa transitória ao arrastar um cartão Pronto |
| Cancelar em Recebido | Só gerente | Obrigatório | Bloqueado com conta aguardando pagamento |
| Cancelar em Em preparo/Pronto | Cozinha, garçom, gerente | Obrigatório | Bloqueado com conta aguardando pagamento |
| Retroceder | Só gerente | Obrigatório | Pelo menu, nunca por arraste |
| Reordenar | Ninguém | — | Ordem fixa por horário de envio |

- **Cancelar/retroceder**: Modal com campo "Motivo" obrigatório (mín. 3 caracteres, enviado como a doc define) e consequência escrita; botão nomeado pela ação.
- **Arrastar (@dnd-kit)**: sensores Pointer (distância 6 px), Touch (somente pela alça; delay 150 ms, tolerância 5 px), Keyboard (Espaço pega/solta, ← → escolhe coluna vizinha, Esc cancela, M abre o menu). Estados: repouso, foco por teclado (anel verde 3 px), arrastando (sombra, sem inclinação), origem (espaço tracejado), destino permitido (contorno verde + linha de inserção), destino bloqueado (hachurado + motivo), rolagem automática (zona de 48 px), pendente, sucesso, falha, conflito. Faixa "Entregar" aparece só ao arrastar um cartão PRONTO (soltar = ENTREGUE). Anúncios aria-live: "Pegou pedido 14. Coluna Em preparo. Solte com Espaço."
- **Concorrência**: eventos SSE recebidos durante um arraste ficam em fila e só são aplicados ao soltar; nunca remova o cartão arrastado de baixo do ponteiro. Após qualquer evento, refaça GET e reconcilie por id com a maior versao. Desabilite o botão durante o envio (duplo clique). Alteração recusada volta à origem e nunca permanece confirmada.
- **Responsivo**: telas menores rolam horizontalmente com snap; no celular, uma coluna por vez via seg.

## 16. Testes
- Unitários/integração: Vitest + Testing Library + MSW: cliente HTTP e mapa de erros (400–429, 500, rede), formatadores (BRL, datas), parser SSE com heartbeat e reconexão, máquina de estados do Kanban e permissões, otimismo com rollback e 409, troco/restante, validações, componentes (Button, Tag, Stepper, Modal com foco, Toast com roles).
- E2E: Playwright: pareamento completo (T1→T3); pedido ponta a ponta (cardápio → rascunho → enviar → aparece no Kanban → avançar até entregue → tablet reflete); chamado e atendimento; fechamento com troco; fechamento bloqueado por pendências e forçado pelo gerente; revogação de tablet; conflito 409 com duas sessões; expiração 401; teclado no Kanban.
- Acessibilidade: axe nos fluxos principais sem violações sérias; teste manual de foco e leitura.
- Visual: compare cada tela com a Parte B (1280×800 tablet, 1440 desktop, 390×844 celular) e corrija diferenças de espaçamento, tipografia, cor e copy.

## 17. Critérios de aceite
1. Todas as telas da Parte B existem e navegam pelo fluxo real, sem links mortos.
2. Cada tela usa dados reais da API; nenhum dado fixo em produção.
3. Todos os estados (carregando, vazio, erro, sem conexão, sem permissão, sucesso) existem e usam a copy da Parte B.
4. Tokens de equipe e tablet nunca se misturam; 401/403 tratados.
5. Kanban: botão, mouse, toque (só pela alça) e teclado produzem a mesma transição; 409 e SSE tratados sem perder cartões.
6. Moeda, datas e números em pt-BR, tabulares; America/Sao_Paulo; dia operacional 04:00.
7. WCAG AA: contraste, foco, alvos, teclado, status com texto + símbolo, reduced motion.
8. Toasts e animações conforme as seções 7 e 8, sem queda perceptível de desempenho.
9. Build, lint e tsc sem erros; sem erros no console nem warnings de React.

## 18. Entregáveis
- Código completo, organizado (seção 3), README (instalação, variáveis, scripts dev/build/test/e2e/lint, como parear um tablet de teste).
- docs/DIVERGENCIAS.md: todo ponto em que design e API discordam ou faltou informação, com a decisão tomada.
- Fixtures MSW e testes. Sem dependências desnecessárias.

## 19. Proibições
- Nada que a API não oferece: busca no servidor, upload de imagem, desfazer, cancelar comanda, SSE de chamados, geração de PIX, pagamento cobrado pelo sistema.
- Nada de campos extras em requisições nem repetição automática de POST/PATCH.
- Nada de bibliotecas de UI prontas, ícones genéricos de IA, gradientes decorativos, emojis na interface, copy em inglês ou jargão técnico visível.
- Não simplifique o Kanban nem pule estados.

## 20. Autoverificação final (antes de entregar)
Percorra a Parte B tela por tela e marque: rota existe; dados reais; copy idêntica; estados; permissões; teclado; responsividade; testes. Rode lint, tsc, testes e e2e. Registre o resultado no README e não declare concluído com item pendente.

---

# PARTE B — SÍNTESE DO DESIGN (fonte de verdade visual)

## B1. Visão geral
27 artboards em sete áreas, uma identidade editorial e três densidades: respiro no tablet da mesa, alta densidade na operação, sobriedade na gerência.

| Área | Telas | Dispositivo |
|---|---|---|
| Fundação | Conceito, mapa de telas, sistema de design | Documento |
| Tablet da mesa | T1–T10 (pareamento até encerramento) | 1280×800 paisagem |
| Produção | E1 login, E2 Kanban, E3 especificação do Kanban | 1180×820 |
| Garçom | E4 chamados, E5 aprovar tablet | Celular 390×844 |
| Caixa | C1 comandas, C2 fechamento e pagamento | Desktop 1440 |
| Gerência | G1 dashboard, G2 produtos, G3 dispositivos, G4 usuários, G5 adicionais e mesas | Desktop 1440 |
| Transversal | S1 estados e mensagens (22 casos), S2 anotações de API | Documento |

Fluxos: o cliente começa em T1 e a equipe em E1. Dados de exemplo consistentes: Mesa 07 com pedidos Nº 11, 14, 16, 17; conta R$ 530,10 (471,00 + 47,10 de taxa + 12,00 de couvert).

## B2. Identidade
Fraunces nos momentos de escolha (tablet da mesa, wordmark, título de página da gerência, nome de prato) e Source Sans 3 em todo o resto, com algarismos tabulares para preços, tempos e contagens. Superfícies marfim e porcelana; verde profundo reservado à ação principal; latão só em filetes e pontos.
- **Assinatura**: "filete numerado" (numeral tabular em latão tinta + rótulo em caixa-alta + linha de 1 px latão) e o ponto de latão (6 px). Marcam estrutura, nunca urgência.
- **Monograma**: P de haste e bojo aberto + ponto latão. SVG 32×32: `path d="M9 28V4h8.5a8 8 0 0 1 0 16H9" fill="none" stroke="currentColor" stroke-width="3.2"` + `circle cx="23" cy="26" r="2.4" fill="#A88954"`.
- **Forma**: superfícies planas, raio 6 (tags)/8 (controles)/10 (superfícies), borda 1 px, sombra só em sobreposições. Espaçamento base 4.
- **Fotografia**: só no cardápio, em espaços reservados (luz lateral, prato em porcelana, fundos minerais), via variáveis --tom (fundo) e --comida (cor do prato). Imagem real só por imagemUrl.
- **Vocabulário**: item, pedido ("Nº 14"), mesa ("Mesa 07") e comanda são distintos; "rascunho" é o pedido ainda não enviado.
- **Movimento**: 120/200/240 ms, ease-out cubic-bezier(.2,.7,.2,1).

## B3. Tokens (copie para src/design/tokens.css)
```css
:root{
  --marfim:#F5F1E8; --marfim-2:#ECE6D7; --porcelana:#FFFCF7;
  --verde:#183C34; --verde-2:#2A5448; --verde-t:#E1EAE5;
  --carvao:#252823; --mudo:#5A5D55;
  --latao:#A88954;        /* só decorativo, 2,9:1, nunca texto */
  --latao-txt:#7A5F2E;    /* texto, 5,3:1 sobre marfim */
  --fio:#DDD6C5; --fio-forte:#BDB4A0;
  --erro:#A23B2C; --erro-bg:#F8E5E0;
  --atencao:#7A4F00; --atencao-bg:#F8EBC9;
  --info:#2C5B7A; --info-bg:#E1ECF3;
  --sucesso:#2B6A3F; --sucesso-bg:#E2EFE0;
  --r-tag:6px; --r-ctl:8px; --r-surf:10px;
  --dur-1:120ms; --dur-2:200ms; --dur-3:240ms;
  --ease:cubic-bezier(.2,.7,.2,1);
  --font-display:'Fraunces',Georgia,serif;
  --font-ui:'Source Sans 3',system-ui,sans-serif;
}
```
Contrastes: verde sobre porcelana 11,8:1; carvão sobre marfim 13,2:1; mudo sobre marfim 5,9:1; erro 5,4:1 sobre #F8E5E0; atenção 6,0:1 sobre #F8EBC9; info 6,1:1 sobre #E1ECF3; sucesso 5,5:1 sobre #E2EFE0. Toda cor semântica vem com símbolo e palavra.

Uso: marfim = fundo; porcelana = superfícies/cartões; verde = ação principal, navegação ativa, cabeçalho do garçom e lateral; latão tinta = numeração em texto; fio = bordas; erro = falhas e atraso; atenção = avisos; info = notas; sucesso = confirmações.

Escala tipográfica: 13, 14, 15, 16, 18, 22, 24, 34, 38, 44. Títulos Fraunces peso 420–500, tracking −.02em.

## B4. Telas por perfil (partida e ação principal, sempre em verde)
| Perfil | Tela | O que mostra | Ação principal |
|---|---|---|---|
| Mesa | T1 Pareamento | Código ABC 234, validade 10 min, espera | Aguardar aprovação (ou gerar outro código) |
| Mesa | T2 Código vencido | Aviso e código anterior riscado | Gerar novo código |
| Mesa | T3 Boas-vindas | "Mesa 07" em destaque | Ver o cardápio |
| Mesa | T4 Cardápio | Categorias numeradas, busca, pratos, esgotados | Escolher um prato |
| Mesa | T5 Produto | Foto, descrição, adicionais, observação, quantidade | Adicionar ao rascunho (R$ 83,00) |
| Mesa | T6 Rascunho | Itens editáveis, observação geral, subtotal R$ 108,00 | Enviar pedido |
| Mesa | T7 Pedido enviado | Nº 17, itens enviados | Acompanhar pedidos |
| Mesa | T8 Comanda | Pedidos com status, conta R$ 530,10 | Pedir a conta |
| Mesa | T9 Aguardando pagamento | Total, pedidos em andamento | Chamar garçom |
| Mesa | T10 Encerramento | Conta paga, retorno em 8 s | Voltar ao início |
| Cozinha e bar | E2 Kanban | Três colunas, filtro de estação, atraso, conexão | Avançar o pedido um passo |
| Garçom | E4 Chamados | Mesa, tipo, tempo aberto | Marcar atendido |
| Garçom | E5 Aprovar tablet | Código e escolha da mesa | Aprovar para a mesa |
| Caixa | C1 Comandas | Lista por situação e detalhe da conta | Fechar conta |
| Caixa | C2 Fechamento | Pagamentos, valor recebido, troco, taxa | Confirmar recebimento e fechar |
| Gerência | G1 Dashboard | Total vendido R$ 8.742,00, vendas por hora, tempos | Ler o dia |
| Gerência | G2–G5 | Produtos, dispositivos, usuários, adicionais e mesas | Salvar alterações |

## B5. Dados de exemplo do design (use como fixtures MSW e para conferir a copy)
- **Cardápio** (categoria 04 Massas): destaque "Tagliatelle ao ragu de pato", "Massa fresca, ragu de pato de cocção lenta, laranja e tomilho.", R$ 76,00; esgotado "Rigatoni ao limão siciliano", "Creme leve, raspas de limão e parmesão.", R$ 62,00, "⊘ Esgotado agora"; categoria 06: "Risoto de cogumelos", "Arroz carnaroli, mix de cogumelos e manteiga noisette.", R$ 74,00. Barra flutuante: "2 itens · R$ 108,00 · Ainda não enviado à cozinha." Badges de nav: Rascunho 2, Comanda 3.
- **Chamados**: Mesa 07 Conta 12 min; Mesa 12 Ajuda 8 min; Mesa 03 Garçom 2 min; garçom "Ana".
- **Dispositivos**: Tablet mesa 3 (Online, há 40 s, 02/11 18:20); Tablet mesa 7 (Online, há 12 s, 02/11 18:24); Tablet mesa 12 (Offline, há 14 min, 03/11 11:02); Tablet antigo da 5 (Revogado, há 3 dias, 28/10 17:40); código de aprovação "QWX 482" → Mesa 08 · 4 lugares. Gerente "Diego".
- **Caixa Mesa 03**: subtotal R$ 286,00 (4 pedidos), taxa 10% R$ 28,60, couvert R$ 12,00, total R$ 326,60; sem taxa R$ 298,00; pagamentos PIX 200,00 + dinheiro 126,60 (recebido 150,00, troco 23,40).
- **Dashboard**: total R$ 8.742,00; 64 pedidos; ticket R$ 318,50; taxa R$ 802,40; tempos 17,5 min (preparo) / 4,2 min (entrega); 2 atrasados; 3 cancelados (R$ 126,00).
- **Kanban**: Recebidos 4, Em preparo 3, Prontos 2; Nº 14 Mesa 07 28 min "▲ Atrasado +3 min"; Nº 15 Mesa 11 misto; Mesa 07 com Nº 14 (em preparo), Nº 16 e Nº 17 (recebidos).

## B6. Layouts-chave (medidas de referência)
- Tablet 1280×800: topo 64–72 px; coluna de categorias 288 px (padding 36/32/0/40); conteúdo com padding 36/56/0/24; destaque com foto 380×268 e raio 8; linha de prato com grid 120px 1fr auto; barra flutuante: left 328, right 56, bottom 24, altura 76, raio 10, sombra.
- Lateral desktop (.side): verde #183C34, texto claro; link ativo com fundo verde-2; seção em caixa-alta pequena; rodapé com nome/papel. Página: cabeçalho com eyebrow + h1 Fraunces 34/420; conteúdo com padding 24/40/40 e gap 32; colunas flex-wrap (principal ~2/3, lateral ~1/3).
- Garçom 390×844: cabeçalho verde 14/16, barra inferior de 64 px com 4 itens, conteúdo com padding 16 e cartões separados por filete de 1 px.
- Tabela (.tbl): cabeçalho em caixa-alta pequena mudo, linhas com borda inferior 1 px fio, números à direita, linha selecionada com fundo verde-t, linha inativa a 55%.
- Banner: faixa com fundo semântico, ícone textual à esquerda, texto 14 px; ok ✓, atenção ●, erro ▲.
- Cartão do Kanban: porcelana, borda 1 px fio, raio 10, padding 16; atraso borda 2 px erro; observação em bloco com fundo atenção-bg; coluna com cabeçalho "Recebidos 4" e fundo marfim-2.

## B7. Catálogo de estados e mensagens (S1, 22 casos)
Toda mensagem diz o que aconteceu e oferece um próximo passo. Cubra:
- **Tablet**: carregamento do cardápio; busca sem resultados; prato esgotado ao adicionar; adicional inválido; rascunho expirado (30 min); falha de envio com reenvio do mesmo pedido; reconexão; pedidos pausados com a conta em fechamento; tablet revogado (volta ao pareamento); limite de tentativas (429).
- **Equipe**: quadro vazio; conflito de versão ("Este pedido foi alterado por outra pessoa"); queda de conexão (banner, ações desabilitadas); motivo ausente; soma de pagamentos que não fecha; acesso negado; sessão expirada; código de pareamento recusado.
- Escreva cada texto no tom do design: curto, direto, sem exclamação e sem termos técnicos.

## B8. Lacunas conhecidas da API e como o design as resolve
| Lacuna | Tratamento |
|---|---|
| Sem pedido individual no tablet | A lista vem da comanda, relida a cada evento |
| Sem tempo real para chamados | Polling com "Atualizado há N s" |
| Conflito sem nome de quem alterou | Mensagem "outra pessoa" |
| Pedido Entregue não aparece no quadro | Retroceder um Entregue fica fora do Kanban |
| Sem busca de texto em comandas, chamados e dispositivos | Só filtros por situação e paginação |
| Sem cancelamento de comanda | "Cancelada" só para consulta |
| Taxa e couvert fixos na abertura | Só o caixa remove a taxa, no fechamento |
| Imagens só por endereço | Espaços reservados com tratamento visual |

Observação: o design foi escrito e revisado por leitura; se encontrar qualquer ambiguidade visual, siga os tokens e medidas acima e registre em docs/DIVERGENCIAS.md.
