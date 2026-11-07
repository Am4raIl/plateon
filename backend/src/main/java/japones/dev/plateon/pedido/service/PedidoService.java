package japones.dev.plateon.pedido.service;

import japones.dev.plateon.pedido.service.PedidoEventos;

import japones.dev.plateon.cardapio.domain.*;
import japones.dev.plateon.cardapio.service.*;
import japones.dev.plateon.conta.service.ComandaConsulta;
import japones.dev.plateon.conta.service.ComandaRegras;
import japones.dev.plateon.compartilhado.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class PedidoService {
    private final Sql db; private final Clock clock; private final Tempo tempo; private final AdicionalPolicy policy;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final TransactionTemplate transacoes;
    private final PedidoConsulta consultas;
    private final ComandaConsulta comandas;
    private final ComandaRegras regras;
    @Value("${restaurante.taxa-servico:10}") private BigDecimal taxa;
    @Value("${restaurante.couvert:0.00}") private BigDecimal couvert;
    @Value("${restaurante.rascunho-ttl-minutos:30}") private long ttl;
    public PedidoService(Sql db,Clock clock,Tempo tempo,AdicionalPolicy policy,org.springframework.context.ApplicationEventPublisher events,PlatformTransactionManager manager,
            PedidoConsulta consultas,ComandaConsulta comandas,ComandaRegras regras) {
        this.db=db; this.clock=clock; this.tempo=tempo; this.policy=policy; this.events=events;
        this.transacoes=new TransactionTemplate(manager);
        this.transacoes.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.consultas=consultas; this.comandas=comandas; this.regras=regras;
    }
    public record AdicionalView(String id,String nome,BigDecimal preco) {}
    public record ItemView(String id,String produtoId,String nomeProduto,int quantidade,String observacao,
        BigDecimal precoUnitario,String estacao,List<AdicionalView> adicionais,BigDecimal subtotal) {}
    public record PedidoView(String id,String comandaId,String status,Integer numeroDiario,LocalDate diaOperacional,
        String observacaoGeral,Instant criadoEm,Instant enviadoEm,long versao,List<ItemView> itens,BigDecimal subtotal) {}
    public record ComandaView(String id,String status,int numeroMesa,Instant abertaEm,BigDecimal taxaServicoPercentual,
        BigDecimal couvert,List<PedidoView> pedidos,BigDecimal subtotal,BigDecimal taxaServico,BigDecimal total) {}
    public record ItemInput(@NotBlank String produtoId,@Min(1) int quantidade,@Size(max=200) String observacao,Set<String> adicionaisIds) {}
    public record Envio(String observacaoGeral) {}
    public record ChamadoInput(@NotBlank String tipo) {}
    public record ChamadoView(String id,String tipo,String status,Instant criadoEm) {}
    public record EstadoMesa(String estado,int numeroMesa) {}
    public EstadoMesa estado(String mesaId,int numero) {
        var row=db.optional("SELECT status FROM comanda WHERE mesa_id=? AND status IN ('ABERTA','AGUARDANDO_PAGAMENTO') ORDER BY aberta_em DESC LIMIT 1",mesaId);
        return new EstadoMesa(row==null ? "LIVRE" : db.str(row,"status").equals("ABERTA") ? "EM_ATENDIMENTO" : "AGUARDANDO_PAGAMENTO",numero);
    }
    public ComandaView comandaAtual(String mesaId) {
        return comandas.atual(mesaId);
    }
    public ComandaView comandaPorId(String id) {
        return comandas.porId(id);
    }
    public PedidoView pedido(String pedidoId,String mesaId) {
        return consultas.daMesa(pedidoId,mesaId);
    }
    public PedidoView pedidoAdmin(String pedidoId) { return consultas.porId(pedidoId); }
    private PedidoView view(Map<String,Object> row) {
        return consultas.carregar(List.of(row)).getFirst();
    }
    @Transactional(isolation=Isolation.READ_COMMITTED) public PedidoView rascunho(String mesaId) {
        db.one("SELECT id FROM mesa WHERE id=? AND ativa=1 FOR UPDATE",mesaId);
        var c=db.optional("SELECT * FROM comanda WHERE mesa_id=? AND status='ABERTA' FOR UPDATE",mesaId);
        if(c==null) {
            Validar.exigir(db.optional("SELECT id FROM comanda WHERE mesa_id=? AND status='AGUARDANDO_PAGAMENTO'",mesaId)==null,
                HttpStatus.CONFLICT,"Mesa aguardando pagamento");
            String id=db.id();
            try { db.jdbc().update("INSERT INTO comanda(id,mesa_id,status,aberta_em,taxa_servico_percentual,couvert) VALUES(?,?,'ABERTA',?,?,?)",
                id,mesaId,db.ts(clock.instant()),taxa,couvert); }
            catch(DataIntegrityViolationException ex) { c=db.one("SELECT * FROM comanda WHERE mesa_id=? AND status='ABERTA'",mesaId); }
            if(c==null) c=db.one("SELECT * FROM comanda WHERE id=?",id);
        }
        String comandaId=db.str(c,"id");
        var p=db.optional("SELECT * FROM pedido WHERE comanda_id=? AND status='RASCUNHO' FOR UPDATE",comandaId);
        if(p==null) {
            String id=db.id(); var now=db.ts(clock.instant());
            try { db.jdbc().update("INSERT INTO pedido(id,comanda_id,status,criado_em,atualizado_em) VALUES(?,?,'RASCUNHO',?,?)",id,comandaId,now,now); }
            catch(DataIntegrityViolationException ex) { p=db.one("SELECT * FROM pedido WHERE comanda_id=? AND status='RASCUNHO'",comandaId); }
            if(p==null) p=db.one("SELECT * FROM pedido WHERE id=?",id);
        }
        return view(p);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED) public PedidoView adicionar(String mesaId,String pedidoId,ItemInput input) {
        return salvarItem(mesaId,pedidoId,input,null);
    }
    private PedidoView salvarItem(String mesaId,String pedidoId,ItemInput input,String itemExistenteId) {
        var p=rascunhoDaMesa(mesaId,pedidoId);
        Validar.exigir(input.quantidade()>=1,HttpStatus.UNPROCESSABLE_ENTITY,"Quantidade mínima é 1");
        Validar.exigir(input.observacao()==null || input.observacao().length()<=200,HttpStatus.UNPROCESSABLE_ENTITY,"Observação deve ter até 200 caracteres");
        var produto=db.one("SELECT * FROM produto WHERE id=?",input.produtoId());
        Validar.exigir(Boolean.TRUE.equals(produto.get("ativo")) && Boolean.TRUE.equals(produto.get("disponivel")),HttpStatus.UNPROCESSABLE_ENTITY,"Produto indisponível");
        var cat=Categoria.valueOf(db.str(produto,"categoria"));
        Set<String> ids=input.adicionaisIds()==null ? Set.of() : input.adicionaisIds();
        List<Map<String,Object>> adicionais=new ArrayList<>();
        for(String id:ids) {
            var a=db.one("SELECT * FROM adicional WHERE id=?",id);
            var categorias=db.jdbc().queryForList("SELECT categoria FROM adicional_categoria WHERE adicional_id=?",id).stream()
                .map(r -> Categoria.valueOf(db.str(r,"categoria"))).collect(java.util.stream.Collectors.toSet());
            policy.validar(cat,Boolean.TRUE.equals(a.get("ativo")),categorias);
            adicionais.add(a);
        }
        String itemId=itemExistenteId==null ? db.id() : itemExistenteId;
        db.jdbc().update("INSERT INTO item_pedido(id,pedido_id,produto_id,quantidade,observacao,nome_produto,preco_unitario,estacao,categoria) VALUES(?,?,?,?,?,?,?,?,?)",
            itemId,pedidoId,input.produtoId(),input.quantidade(),input.observacao(),produto.get("nome"),produto.get("preco"),produto.get("estacao"),produto.get("categoria"));
        for(var a:adicionais) db.jdbc().update("INSERT INTO item_adicional(id,item_pedido_id,adicional_id,nome,preco) VALUES(?,?,?,?,?)",db.id(),itemId,a.get("id"),a.get("nome"),a.get("preco"));
        tocar(pedidoId); return pedido(pedidoId,mesaId);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED) public PedidoView alterarItem(String mesaId,String pedidoId,String itemId,ItemInput input) {
        rascunhoDaMesa(mesaId,pedidoId); db.one("SELECT id FROM item_pedido WHERE id=? AND pedido_id=?",itemId,pedidoId);
        db.jdbc().update("DELETE FROM item_adicional WHERE item_pedido_id=?",itemId);
        db.jdbc().update("DELETE FROM item_pedido WHERE id=?",itemId);
        return salvarItem(mesaId,pedidoId,input,itemId);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED) public PedidoView removerItem(String mesaId,String pedidoId,String itemId) {
        rascunhoDaMesa(mesaId,pedidoId);
        db.jdbc().update("DELETE FROM item_adicional WHERE item_pedido_id=?",itemId);
        if(db.jdbc().update("DELETE FROM item_pedido WHERE id=? AND pedido_id=?",itemId,pedidoId)==0)
            throw new ApiException(HttpStatus.NOT_FOUND,"Item não encontrado");
        tocar(pedidoId); return pedido(pedidoId,mesaId);
    }
    private Map<String,Object> rascunhoDaMesa(String mesaId,String pedidoId) {
        var bloqueado=regras.bloquearPedido(pedidoId,mesaId);
        regras.exigirAberta(bloqueado.statusComanda());
        var p=bloqueado.pedido();
        Validar.exigir(db.str(p,"status").equals("RASCUNHO"),HttpStatus.CONFLICT,"Pedido já enviado"); return p;
    }
    private void tocar(String id) { db.jdbc().update("UPDATE pedido SET atualizado_em=?,version=version+1 WHERE id=?",db.ts(clock.instant()),id); }
    public PedidoView enviar(String mesaId,String pedidoId,Envio input) {
        for(int tentativa=0;tentativa<20;tentativa++) {
            try { return transacoes.execute(status -> enviarNaTransacao(mesaId,pedidoId,input)); }
            catch(PessimisticLockingFailureException ex) {
                if(tentativa==19) throw new ApiException(HttpStatus.CONFLICT,"Envio concorreu com outras operações; tente novamente");
                try { Thread.sleep(10L + java.util.concurrent.ThreadLocalRandom.current().nextLong(30L + tentativa*5L)); }
                catch(InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new ApiException(HttpStatus.CONFLICT,"Envio interrompido"); }
            }
        }
        throw new IllegalStateException("Tentativas de envio esgotadas");
    }
    private PedidoView enviarNaTransacao(String mesaId,String pedidoId,Envio input) {
        var bloqueado=regras.bloquearPedido(pedidoId,mesaId);
        var p=bloqueado.pedido();
        if(!db.str(p,"status").equals("RASCUNHO")) return view(p);
        regras.exigirAberta(bloqueado.statusComanda());
        Validar.exigir(db.optional("SELECT id FROM item_pedido WHERE pedido_id=? LIMIT 1",pedidoId)!=null,HttpStatus.UNPROCESSABLE_ENTITY,"Pedido vazio");
        var now=clock.instant(); var dia=tempo.diaOperacional(now);
        db.jdbc().update("INSERT IGNORE INTO contador_diario(dia_operacional,ultimo_numero) VALUES(?,0)",dia);
        var counter=db.one("SELECT ultimo_numero FROM contador_diario WHERE dia_operacional=? FOR UPDATE",dia);
        int numero=((Number)counter.get("ultimo_numero")).intValue()+1;
        db.jdbc().update("UPDATE contador_diario SET ultimo_numero=? WHERE dia_operacional=?",numero,dia);
        db.jdbc().update("UPDATE pedido SET status='RECEBIDO',numero_diario=?,dia_operacional=?,observacao_geral=?,enviado_em=?,atualizado_em=?,version=version+1 WHERE id=?",
            numero,dia,input==null ? null : input.observacaoGeral(),db.ts(now),db.ts(now),pedidoId);
        db.jdbc().update("INSERT INTO pedido_status_historico(pedido_id,de,para,em) VALUES(?,'RASCUNHO','RECEBIDO',?)",pedidoId,db.ts(now));
        events.publishEvent(new PedidoEventos.Evento(pedidoId,"RECEBIDO"));
        return pedido(pedidoId,mesaId);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED) public PedidoView cancelar(String mesaId,String pedidoId) {
        var bloqueado=regras.bloquearPedido(pedidoId,mesaId);
        regras.exigirAberta(bloqueado.statusComanda());
        var p=bloqueado.pedido();
        Validar.exigir(db.str(p,"status").equals("RECEBIDO"),HttpStatus.CONFLICT,"Tablet só pode cancelar pedido recebido");
        db.jdbc().update("UPDATE pedido SET status='CANCELADO',version=version+1 WHERE id=?",pedidoId);
        db.jdbc().update("INSERT INTO pedido_status_historico(pedido_id,de,para,em,motivo) VALUES(?,'RECEBIDO','CANCELADO',?,'Cancelado pelo tablet')",pedidoId,db.ts(clock.instant()));
        events.publishEvent(new PedidoEventos.Evento(pedidoId,"CANCELADO"));
        return pedido(pedidoId,mesaId);
    }
    public ChamadoView chamar(String mesaId,ChamadoInput input) {
        Validar.exigir(Set.of("GARCOM","CONTA","AJUDA").contains(input.tipo()),HttpStatus.UNPROCESSABLE_ENTITY,"Tipo de chamado inválido");
        String id=db.id(); var now=clock.instant();
        db.jdbc().update("INSERT INTO chamado_garcom(id,mesa_id,tipo,status,criado_em) VALUES(?,?,?,'ABERTO',?)",id,mesaId,input.tipo(),db.ts(now));
        return new ChamadoView(id,input.tipo(),"ABERTO",now);
    }
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay=300000) public void limparRascunhos() {
        var limite=clock.instant().minusSeconds(ttl*60);
        var rows=db.jdbc().queryForList("SELECT id FROM pedido WHERE status='RASCUNHO' AND atualizado_em < ?",db.ts(limite));
        for(var p:rows) {
            String id=db.str(p,"id");
            try {
                transacoes.executeWithoutResult(tx -> {
                    var atual=regras.bloquearPedido(id,null).pedido();
                    if(!"RASCUNHO".equals(db.str(atual,"status")) || !db.instant(atual,"atualizado_em").isBefore(limite)) return;
                    db.jdbc().update("DELETE ia FROM item_adicional ia JOIN item_pedido i ON i.id=ia.item_pedido_id WHERE i.pedido_id=?",id);
                    db.jdbc().update("DELETE FROM item_pedido WHERE pedido_id=?",id);
                    db.jdbc().update("DELETE FROM pedido WHERE id=?",id);
                });
            } catch(ApiException ex) { if(ex.status()!=HttpStatus.NOT_FOUND) throw ex; }
        }
    }
}
