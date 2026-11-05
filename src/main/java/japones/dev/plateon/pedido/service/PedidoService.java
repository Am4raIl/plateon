package japones.dev.plateon.pedido.service;

import japones.dev.plateon.pedido.service.PedidoEventos;

import japones.dev.plateon.cardapio.domain.*;
import japones.dev.plateon.cardapio.service.*;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class PedidoService {
    private final Sql db; private final Clock clock; private final Tempo tempo; private final AdicionalPolicy policy;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final TransactionTemplate transacoes;
    @Value("${restaurante.taxa-servico:10}") private BigDecimal taxa;
    @Value("${restaurante.couvert:0.00}") private BigDecimal couvert;
    @Value("${restaurante.rascunho-ttl-minutos:30}") private long ttl;
    public PedidoService(Sql db,Clock clock,Tempo tempo,AdicionalPolicy policy,org.springframework.context.ApplicationEventPublisher events,PlatformTransactionManager manager) {
        this.db=db; this.clock=clock; this.tempo=tempo; this.policy=policy; this.events=events;
        this.transacoes=new TransactionTemplate(manager);
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
        var row=db.optional("SELECT c.*,m.numero FROM comanda c JOIN mesa m ON m.id=c.mesa_id WHERE c.mesa_id=? AND c.status IN ('ABERTA','AGUARDANDO_PAGAMENTO') ORDER BY c.aberta_em DESC LIMIT 1",mesaId);
        return row==null ? null : comanda(row);
    }
    public ComandaView comandaPorId(String id) {
        return comanda(db.one("SELECT c.*,m.numero FROM comanda c JOIN mesa m ON m.id=c.mesa_id WHERE c.id=?",id));
    }
    private ComandaView comanda(Map<String,Object> row) {
        var pedidos=db.jdbc().queryForList("SELECT * FROM pedido WHERE comanda_id=? ORDER BY criado_em",row.get("id")).stream().map(this::view).toList();
        BigDecimal subtotal=pedidos.stream().filter(p -> !p.status().equals("CANCELADO") && !p.status().equals("RASCUNHO"))
            .map(PedidoView::subtotal).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal taxaValor=subtotal.multiply(Validar.dinheiro(row.get("taxa_servico_percentual"))).divide(new BigDecimal("100"),2,java.math.RoundingMode.HALF_UP);
        BigDecimal cov=Validar.dinheiro(row.get("couvert"));
        return new ComandaView(db.str(row,"id"),db.str(row,"status"),((Number)row.get("numero")).intValue(),
            db.instant(row,"aberta_em"),Validar.dinheiro(row.get("taxa_servico_percentual")),cov,pedidos,subtotal,taxaValor,subtotal.add(taxaValor).add(cov));
    }
    public PedidoView pedido(String pedidoId,String mesaId) {
        return view(db.one("SELECT p.* FROM pedido p JOIN comanda c ON c.id=p.comanda_id WHERE p.id=? AND c.mesa_id=?",pedidoId,mesaId));
    }
    public PedidoView pedidoAdmin(String pedidoId) { return view(db.one("SELECT * FROM pedido WHERE id=?",pedidoId)); }
    private PedidoView view(Map<String,Object> row) {
        var items=db.jdbc().queryForList("SELECT * FROM item_pedido WHERE pedido_id=?",row.get("id")).stream().map(i -> {
            var ads=db.jdbc().queryForList("SELECT * FROM item_adicional WHERE item_pedido_id=?",i.get("id")).stream()
                .map(a -> new AdicionalView(db.str(a,"adicional_id"),db.str(a,"nome"),Validar.dinheiro(a.get("preco")))).toList();
            BigDecimal unit=Validar.dinheiro(i.get("preco_unitario"));
            BigDecimal price=ads.stream().map(AdicionalView::preco).reduce(unit,BigDecimal::add);
            return new ItemView(db.str(i,"id"),db.str(i,"produto_id"),db.str(i,"nome_produto"),((Number)i.get("quantidade")).intValue(),
                db.str(i,"observacao"),unit,db.str(i,"estacao"),ads,price.multiply(BigDecimal.valueOf(((Number)i.get("quantidade")).longValue())));
        }).toList();
        BigDecimal subtotal=items.stream().map(ItemView::subtotal).reduce(BigDecimal.ZERO,BigDecimal::add);
        return new PedidoView(db.str(row,"id"),db.str(row,"comanda_id"),db.str(row,"status"),
            row.get("numero_diario")==null ? null : ((Number)row.get("numero_diario")).intValue(),
            row.get("dia_operacional")==null ? null : row.get("dia_operacional") instanceof java.sql.Date sqlDate ? sqlDate.toLocalDate() : (LocalDate)row.get("dia_operacional"),
            db.str(row,"observacao_geral"),db.instant(row,"criado_em"),db.instant(row,"enviado_em"),
            ((Number)row.get("version")).longValue(),items,subtotal);
    }
    @Transactional public PedidoView rascunho(String mesaId) {
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
    @Transactional public PedidoView adicionar(String mesaId,String pedidoId,ItemInput input) {
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
        db.jdbc().update("INSERT INTO item_pedido(id,pedido_id,produto_id,quantidade,observacao,nome_produto,preco_unitario,estacao) VALUES(?,?,?,?,?,?,?,?)",
            itemId,pedidoId,input.produtoId(),input.quantidade(),input.observacao(),produto.get("nome"),produto.get("preco"),produto.get("estacao"));
        for(var a:adicionais) db.jdbc().update("INSERT INTO item_adicional(id,item_pedido_id,adicional_id,nome,preco) VALUES(?,?,?,?,?)",db.id(),itemId,a.get("id"),a.get("nome"),a.get("preco"));
        tocar(pedidoId); return pedido(pedidoId,mesaId);
    }
    @Transactional public PedidoView alterarItem(String mesaId,String pedidoId,String itemId,ItemInput input) {
        rascunhoDaMesa(mesaId,pedidoId); db.one("SELECT id FROM item_pedido WHERE id=? AND pedido_id=?",itemId,pedidoId);
        db.jdbc().update("DELETE FROM item_adicional WHERE item_pedido_id=?",itemId);
        db.jdbc().update("DELETE FROM item_pedido WHERE id=?",itemId);
        return salvarItem(mesaId,pedidoId,input,itemId);
    }
    @Transactional public PedidoView removerItem(String mesaId,String pedidoId,String itemId) {
        rascunhoDaMesa(mesaId,pedidoId);
        db.jdbc().update("DELETE FROM item_adicional WHERE item_pedido_id=?",itemId);
        if(db.jdbc().update("DELETE FROM item_pedido WHERE id=? AND pedido_id=?",itemId,pedidoId)==0)
            throw new ApiException(HttpStatus.NOT_FOUND,"Item não encontrado");
        tocar(pedidoId); return pedido(pedidoId,mesaId);
    }
    private Map<String,Object> rascunhoDaMesa(String mesaId,String pedidoId) {
        var p=db.one("SELECT p.* FROM pedido p JOIN comanda c ON c.id=p.comanda_id WHERE p.id=? AND c.mesa_id=? FOR UPDATE",pedidoId,mesaId);
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
        var p=db.one("SELECT p.* FROM pedido p JOIN comanda c ON c.id=p.comanda_id WHERE p.id=? AND c.mesa_id=? FOR UPDATE",pedidoId,mesaId);
        if(!db.str(p,"status").equals("RASCUNHO")) return view(p);
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
    @Transactional public PedidoView cancelar(String mesaId,String pedidoId) {
        var p=db.one("SELECT p.* FROM pedido p JOIN comanda c ON c.id=p.comanda_id WHERE p.id=? AND c.mesa_id=? FOR UPDATE",pedidoId,mesaId);
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
    @Transactional @org.springframework.scheduling.annotation.Scheduled(fixedDelay=300000) public void limparRascunhos() {
        var rows=db.jdbc().queryForList("SELECT id FROM pedido WHERE status='RASCUNHO' AND atualizado_em < ? FOR UPDATE",db.ts(clock.instant().minusSeconds(ttl*60)));
        for(var p:rows) {
            String id=db.str(p,"id");
            db.jdbc().update("DELETE ia FROM item_adicional ia JOIN item_pedido i ON i.id=ia.item_pedido_id WHERE i.pedido_id=?",id);
            db.jdbc().update("DELETE FROM item_pedido WHERE pedido_id=?",id);
            db.jdbc().update("DELETE FROM pedido WHERE id=? AND status='RASCUNHO'",id);
        }
    }
}
