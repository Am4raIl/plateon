# Reformulação visual · 11/11/2026

## Refinamento visual · 12/11/2026

- Paleta carvão, marfim e dourado preservada; superfícies com cantos suaves,
  bordas mais discretas e sombras leves. Padrão geométrico mais visível nos
  cabeçalhos, seguindo a referência de cardápio.
- Hovers graduais em botões, navegação, categorias, cards e menus. Seleção de
  categorias mantém a fonte e reserva o espaço do indicador; navegação usa um
  detalhe interno em dourado, sem acrescentar contornos externos.
- Cards atrasados e em arraste mantêm a espessura da borda para evitar mudanças
  de tamanho. Transferências usam duração proporcional à distância, inclinação
  menor e sobreposição temporária durante o deslocamento. Cards vizinhos animam
  a acomodação; colunas ocultas no celular não originam movimentos de (0, 0).
- APIs, permissões, regras de negócio e ordenação por envio/id preservadas.

Validação desta etapa: build de produção, TypeScript, lint e seis testes de
navegador existentes aprovados (pedido até entrega, conflito, acessibilidade,
responsividade e Kanban por mouse/teclado). Dois novos testes de navegador
aprovados verificam o encaixe entre cards existentes, a animação dos vizinhos e
a preferência por movimento reduzido. As dimensões dos botões de categoria
antes/depois da seleção foram conferidas no navegador e permaneceram iguais.
Revisão visual do quadro e cardápio em desktop/celular, sem transbordamento da
página. Os unitários seguem com 51 aprovações e as mesmas duas falhas descritas
abaixo. Não houve commit nem push.

## Base visual anterior

A interface segue a referência de cardápio fornecida: carvão, marfim,
dourado envelhecido, títulos serifados, padrões geométricos e folhagens discretas.

O tema cobre início, login, pareamento, cardápio, produtos, pedidos, comandas,
recebimentos, produção e gerência. Os nomes dos tokens existentes foram mantidos
para compartilhar a paleta entre todas as telas. Os SVGs decorativos são locais
e não dependem de serviços externos. A navegação lateral recebeu ícones.

As alterações de código se limitam à apresentação: estilos, ícones, cores das
ilustrações e cores da animação de atualização do Kanban. Rotas, chamadas de API,
permissões, autenticação e regras de negócio foram preservadas.

## Validação

- Build de produção e TypeScript: aprovados.
- Formatação dos arquivos alterados e `git diff --check`: aprovados.
- Acessibilidade automatizada (WCAG A/AA): login, dashboard, produção e cardápio
  aprovados. A etapa de acessibilidade do teste de tablet passou antes da falha
  de navegação descrita abaixo.
- Cardápio revisado em 360, 390, 768 e 1280 px; detalhes de produto em 360 px;
  dashboard em 390 e 1440 px. Sem transbordamento horizontal da página.
- Testes unitários: 51 aprovados, 2 falhas preexistentes.
- Testes de navegador, executados em lotes: 20 aprovados, 9 falhas preexistentes.
  Entre os aprovados estão pedido até entrega, pagamento e retorno do tablet ao
  pareamento, cadastros, permissões e Kanban por mouse e teclado.

Todas as falhas abaixo foram reproduzidas numa cópia temporária da versão
original do repositório (`ebdfa40`), com as mesmas dependências. Os testes não foram
alterados para acomodar o novo visual.

## Falhas existentes na suíte

Unitários:

- Fechamento: o teste recebe sessão expirada ao consultar a comanda.
- Campo monetário: o teste espera `126,60`, enquanto o componente retorna
  `R$ 126,60`.

Navegador:

- Menu móvel de gerência: seletores parciais encontram mais de um elemento.
- Busca: o teste procura o botão “Limpar busca” quando há resultados, mas a
  interface só o oferece no estado vazio.
- Encerramento: o teste procura “Voltar ao pareamento”, que não está disponível
  no fluxo existente.
- Abertura de comanda: o teste procura um campo “Mesa” no diálogo que não
  corresponde ao formulário atual.
- Três testes de fechamento procuram “Ver conta” na tela inicial do garçom,
  sem navegar para comandas.
- Catálogo de gerência no tablet: o teste procura um link de nome exato
  “Usuários”; o atalho disponível inclui a descrição no nome acessível.
- Kanban por toque: o arraste começa, mas o teste espera `aria-pressed` na alça
  de origem, que fica oculta durante o arraste.

O ambiente usa Node 26. Os testes unitários foram executados com
`NODE_OPTIONS=--no-experimental-webstorage npm test`, para utilizar o storage
do jsdom. Sem essa opção, o storage experimental do Node interfere no setup
existente da suíte.
