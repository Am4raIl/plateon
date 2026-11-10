# Decisões e diferenças de contrato

Implementação em 07/11/2026. Precedência: contrato e código do backend, depois design de GERACAO_FRONTEND.md.

| Ponto | Decisão e motivo |
|---|---|
| Stack atual | Next.js 16/React 19/TypeScript. O App Router hospeda as telas atuais em um componente cliente, preservando o React Router usado pelos fluxos. `/api/v1` passa pelo proxy do Next para o backend na porta 8081. |
| Marca | Interface, backend e diretório Plateon. |
| Login | Label **Usuário**, pois a API recebe `username`, não e-mail. LoginView não fornece nome; o cabeçalho usa o usuário informado e o papel, sem inventar identidade. |
| Pareamento | Rotas públicas `/dispositivos/pareamento` e `/dispositivos/pareamento/{id}`, sem Bearer. A rota citada no design não existe. |
| Mesa no garçom | O garçom pode listar mesas ativas para parear tablets e abrir comandas, consultar dispositivos e revogar um pareamento. A edição dos dispositivos continua restrita ao gerente. UUIDs não aparecem na interface. |
| Transição de Kanban | Usado `{novoStatus,motivo,versao}`, conforme a API; o exemplo visual usa `status`. |
| Estado financeiro no cartão | Cartao não inclui status da comanda. Papéis autorizados consultam comandas para marcar bloqueios. COZINHA não pode consultá-las: a resposta da alteração é autoridade final. Ocultação preventiva completa na cozinha exigiria esse dado no Kanban do backend. |
| Atraso excedente | A API devolve `atrasado` e `minutosDecorridos`, sem limite nem minutos excedentes. Exibido **▲ Atrasado · N min decorridos**, sem supor margem para calcular `+N`. |
| Adicionais | A resposta não fornece grupos obrigatórios nem limites por grupo. Seleção opcional dos adicionais disponíveis, sem regras inventadas. Observação do item limitada a 200 caracteres. Vínculo de adicionais é por categoria, não pelo ProdutoInput. |
| Pedido misto | Todo o pedido é movido junto, com aviso de cozinha e bar. Não existem status por item. |
| Cancelar no tablet | A API permite cancelar RECEBIDO, mas o design pede não oferecer cancelamento na mesa. A ação existe somente na equipe, respeitando papel e etapa. |
| Conta paga | Depois do pagamento, o backend revoga o tablet da mesa na mesma transação. A próxima consulta do tablet recebe 401, limpa a sessão e volta ao pareamento. A comanda paga permanece no histórico. |
| Couvert | A gerência altera o valor global em `/gerencia/couvert`; a abertura copia esse valor para a comanda. Contas já abertas preservam o valor anterior. |
| Equipe | O papel CAIXA foi retirado; a migração converte usuários existentes para GARCOM. Garçom e gerente podem registrar pagamentos e retroceder pedidos com motivo. Somente gerente força fechamento. |
| Remoção de taxa | **Atualizar total e iniciar fechamento** consulta o novo total na API antes de registrar pagamentos. Não se subtrai taxa no cliente. A API não oferece restaurar uma taxa já removida. |
| Imagens do seed | Respostas podem conter caminhos relativos, resolvidos pela origem da API. ProdutoInput aceita somente HTTP(S) ou null. O formulário avisa que salvar sem nova URL remove a imagem de demonstração. Disponibilidade usa a rota específica e não altera imagem. |
| Paginação e busca | Usados `pagina` e `tamanho`. Busca do tablet permanece local por nome/descrição. Produtos administrativos usam a busca suportada. Não se inventa busca em chamados, comandas ou dispositivos. |
| Rascunho | Recuperado pela comanda. Alteração com 404 mostra expiração e **Começar outro**; não há leitura isolada de pedido do tablet. |
| Fundação e S1/S2 | A Parte B os descreve como documentos, não telas operacionais. Tokens e componentes estão no código; matriz de estados na documentação. |
| Referência visual | Existem tokens e medidas, sem imagens dos artboards. Implementados os layouts, monograma, tipografia e hierarquia descritos; capturas não equivalem a uma comparação pixel a pixel com arquivos ausentes. |
| Homologação real | Em uma execução local anterior, a API em `localhost:8081` respondeu com saúde `UP`, login de desenvolvimento e consulta às 12 mesas. A suíte de navegador da migração usa MSW; fluxo completo com banco real ainda requer validação manual. O proxy do Next elimina a configuração de CORS no desenvolvimento normal. |
