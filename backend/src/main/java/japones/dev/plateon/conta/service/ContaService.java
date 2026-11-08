package japones.dev.plateon.conta.service;


import japones.dev.plateon.compartilhado.*;
import japones.dev.plateon.pedido.service.PedidoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContaService {
    private final Sql db; private final Clock clock; private final PedidoService pedidos;
    private final ComandaConsulta consultas;
    private final org.springframework.context.ApplicationEventPublisher events;
    public ContaService(Sql db,Clock clock,PedidoService pedidos,ComandaConsulta consultas,org.springframework.context.ApplicationEventPublisher events) {
        this.db=db;this.clock=clock;this.pedidos=pedidos;this.consultas=consultas;
        this.events=events;
    }
    public record PagamentoInput(@NotBlank String forma,@NotNull @DecimalMin("0.01") @Digits(integer=8,fraction=2) BigDecimal valor,
        @Digits(integer=8,fraction=2) BigDecimal valorRecebido) {}
    public record Fechamento(List<@Valid PagamentoInput> pagamentos,boolean removerTaxa,boolean removerCouvert,boolean forcar) {
        public Fechamento(List<PagamentoInput> pagamentos,boolean removerTaxa,boolean forcar) {
            this(pagamentos,removerTaxa,false,forcar);
        }
    }
    public record FechamentoView(PedidoService.ComandaView comanda,BigDecimal troco) {}
    public record Reabertura(@NotBlank String motivo) {}
    private boolean gerente() { return SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_GERENTE")); }
    private void receber() {
        boolean autorizado=SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
            .anyMatch(a -> Set.of("ROLE_GARCOM","ROLE_GERENTE").contains(a.getAuthority()));
        Validar.exigir(autorizado,HttpStatus.FORBIDDEN,"Permissão de recebimento necessária");
    }
    private void garcom() {
        boolean autorizado=SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
            .anyMatch(a -> Set.of("ROLE_GARCOM","ROLE_GERENTE").contains(a.getAuthority()));
        Validar.exigir(autorizado,HttpStatus.FORBIDDEN,"Permissão de garçom necessária");
    }
    public Pagina<PedidoService.ComandaView> listar(int pagina,int tamanho,String status) {
        return listar(pagina,tamanho,status,consultas::porIds);
    }
    public Pagina<ComandaConsulta.Resumo> resumos(int pagina,int tamanho,String status) {
        return listar(pagina,tamanho,status,consultas::resumosPorIds);
    }
    private <T> Pagina<T> listar(int pagina,int tamanho,String status,java.util.function.Function<List<String>,List<T>> carregar) {
        int offset=Pagina.offset(pagina,tamanho);
        String filtro=status==null || status.isBlank() ? "ATIVAS" : status.toUpperCase(Locale.ROOT);
        Validar.exigir(Set.of("ATIVAS","ABERTA","AGUARDANDO_PAGAMENTO","PAGA","CANCELADA").contains(filtro),
            HttpStatus.BAD_REQUEST,"Status de comanda inválido");
        boolean ativas=filtro.equals("ATIVAS");
        String where=ativas ? "status IN ('ABERTA','AGUARDANDO_PAGAMENTO')" : "status=?";
        Long total=ativas ? db.jdbc().queryForObject("SELECT COUNT(*) FROM comanda WHERE "+where,Long.class)
            : db.jdbc().queryForObject("SELECT COUNT(*) FROM comanda WHERE "+where,Long.class,filtro);
        var rows=ativas ? db.jdbc().queryForList("SELECT id FROM comanda WHERE "+where+" ORDER BY aberta_em DESC,id DESC LIMIT ? OFFSET ?",tamanho,offset)
            : db.jdbc().queryForList("SELECT id FROM comanda WHERE "+where+" ORDER BY aberta_em DESC,id DESC LIMIT ? OFFSET ?",filtro,tamanho,offset);
        return Pagina.criar(carregar.apply(rows.stream().map(r -> db.str(r,"id")).toList()),pagina,tamanho,total);
    }
    public PedidoService.ComandaView abrir(String mesaId) { garcom(); pedidos.rascunho(mesaId); return pedidos.comandaAtual(mesaId); }
    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED) public FechamentoView fechar(String id,Fechamento input) {
        receber(); var row=db.one("SELECT * FROM comanda WHERE id=? FOR UPDATE",id);
        Validar.exigir(Set.of("ABERTA","AGUARDANDO_PAGAMENTO").contains(db.str(row,"status")),HttpStatus.CONFLICT,"Comanda não está aberta");
        var pendentes=db.jdbc().queryForList("SELECT status FROM pedido WHERE comanda_id=? AND status NOT IN ('ENTREGUE','CANCELADO')",id);
        Validar.exigir(pendentes.isEmpty() || input.forcar() && gerente(),HttpStatus.CONFLICT,"Ainda existem pedidos não entregues");
        if(input.removerTaxa()) db.jdbc().update("UPDATE comanda SET taxa_pre_fechamento=COALESCE(taxa_pre_fechamento,taxa_servico_percentual),taxa_servico_percentual=0 WHERE id=?",id);
        if(input.removerCouvert()) db.jdbc().update("UPDATE comanda SET couvert_pre_fechamento=COALESCE(couvert_pre_fechamento,couvert),couvert=0 WHERE id=?",id);
        db.jdbc().update("UPDATE comanda SET status='AGUARDANDO_PAGAMENTO',atualizada_em=? WHERE id=?",db.ts(clock.instant()),id);
        var pagamentos=input.pagamentos()==null ? List.<PagamentoInput>of() : input.pagamentos();
        if(pagamentos.isEmpty()) return new FechamentoView(pedidos.comandaPorId(id),BigDecimal.ZERO);
        var valores=consultas.porId(id);
        BigDecimal total=valores.total();
        Validar.exigir(pagamentos.stream().allMatch(p -> p.valor()!=null && p.valor().signum()>0),HttpStatus.UNPROCESSABLE_ENTITY,"Valor de pagamento inválido");
        BigDecimal soma=pagamentos.stream().map(PagamentoInput::valor).reduce(BigDecimal.ZERO,BigDecimal::add);
        Validar.exigir(soma.compareTo(total)==0,HttpStatus.UNPROCESSABLE_ENTITY,"Pagamentos devem somar exatamente o total da conta");
        BigDecimal troco=BigDecimal.ZERO;
        for(var p:pagamentos) {
            Validar.exigir(Set.of("DINHEIRO","PIX","CARTAO_CREDITO","CARTAO_DEBITO").contains(p.forma()),HttpStatus.UNPROCESSABLE_ENTITY,"Forma de pagamento inválida");
            Validar.exigir(p.valor()!=null && p.valor().signum()>0,HttpStatus.UNPROCESSABLE_ENTITY,"Valor de pagamento inválido");
            if(p.forma().equals("DINHEIRO")) {
                BigDecimal recebido=p.valorRecebido()==null ? p.valor() : p.valorRecebido();
                Validar.exigir(recebido.compareTo(p.valor())>=0,HttpStatus.UNPROCESSABLE_ENTITY,"Valor recebido insuficiente");
                troco=troco.add(recebido.subtract(p.valor()));
            } else Validar.exigir(p.valorRecebido()==null,HttpStatus.UNPROCESSABLE_ENTITY,"Valor recebido só é aceito em dinheiro");
            db.jdbc().update("INSERT INTO pagamento(id,comanda_id,forma,valor,registrado_em,registrado_por) VALUES(?,?,?,?,?,?)",
                db.id(),id,p.forma(),p.valor(),db.ts(clock.instant()),SecurityContextHolder.getContext().getAuthentication().getName());
        }
        // Rascunhos não foram cobrados e não podem ser enviados depois do fechamento forçado.
        var rascunhos=db.jdbc().queryForList("SELECT id FROM pedido WHERE comanda_id=? AND status='RASCUNHO' FOR UPDATE",id);
        for(var rascunho:rascunhos) {
            db.jdbc().update("INSERT INTO pedido_status_historico(pedido_id,de,para,em,usuario_id,motivo) VALUES(?,'RASCUNHO','CANCELADO',?,?,?)",
                rascunho.get("id"),db.ts(clock.instant()),SecurityContextHolder.getContext().getAuthentication().getName(),"Rascunho descartado no fechamento forçado");
        }
        db.jdbc().update("UPDATE pedido SET status='CANCELADO',atualizado_em=?,version=version+1 WHERE comanda_id=? AND status='RASCUNHO'",db.ts(clock.instant()),id);
        db.jdbc().update("UPDATE comanda SET status='PAGA',fechada_em=?,atualizada_em=?,subtotal_fechamento=?,taxa_fechamento=?,total_fechamento=?,taxa_pre_fechamento=NULL,couvert_pre_fechamento=NULL WHERE id=?",
            db.ts(clock.instant()),db.ts(clock.instant()),valores.subtotal(),valores.taxaServico(),total,id);
        db.jdbc().update("UPDATE chamado_garcom SET status='ATENDIDO',atendido_em=?,atendido_por=? WHERE mesa_id=? AND tipo='CONTA' AND status='ABERTO' AND criado_em>=?",
            db.ts(clock.instant()),SecurityContextHolder.getContext().getAuthentication().getName(),row.get("mesa_id"),row.get("aberta_em"));
        db.jdbc().update("UPDATE dispositivo SET ativo=0,revogado_em=? WHERE mesa_id=? AND ativo=1",db.ts(clock.instant()),row.get("mesa_id"));
        for(var rascunho:rascunhos) events.publishEvent(new japones.dev.plateon.pedido.service.PedidoEventos.Evento(db.str(rascunho,"id"),"CANCELADO"));
        return new FechamentoView(pedidos.comandaPorId(id),troco);
    }
    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public PedidoService.ComandaView retomar(String id) {
        receber();
        var row=db.one("SELECT status FROM comanda WHERE id=? FOR UPDATE",id);
        Validar.exigir("AGUARDANDO_PAGAMENTO".equals(db.str(row,"status")),HttpStatus.CONFLICT,"A comanda precisa estar aguardando pagamento");
        db.jdbc().update("UPDATE comanda SET status='ABERTA',taxa_servico_percentual=COALESCE(taxa_pre_fechamento,taxa_servico_percentual),couvert=COALESCE(couvert_pre_fechamento,couvert),taxa_pre_fechamento=NULL,couvert_pre_fechamento=NULL,atualizada_em=? WHERE id=?",db.ts(clock.instant()),id);
        return pedidos.comandaPorId(id);
    }
    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public PedidoService.ComandaView reabrir(String id,Reabertura input) {
        receber();
        String motivo=input.motivo().trim();
        Validar.exigir(motivo.length()>=3 && motivo.length()<=500,HttpStatus.UNPROCESSABLE_ENTITY,"Informe um motivo de 3 a 500 caracteres");
        var row=db.one("SELECT * FROM comanda WHERE id=? FOR UPDATE",id);
        Validar.exigir("PAGA".equals(db.str(row,"status")),HttpStatus.CONFLICT,"A comanda precisa estar paga para reabrir");
        Validar.exigir(db.optional("SELECT id FROM comanda WHERE mesa_id=? AND id<>? AND status IN ('ABERTA','AGUARDANDO_PAGAMENTO')",row.get("mesa_id"),id)==null,
            HttpStatus.CONFLICT,"A mesa ja possui outra comanda ativa");
        Validar.exigir(db.optional("SELECT id FROM comanda WHERE mesa_id=? AND id<>? AND aberta_em>?",row.get("mesa_id"),id,row.get("aberta_em"))==null,
            HttpStatus.CONFLICT,"Existe uma comanda mais recente para esta mesa");
        String reaberturaId=db.id();
        String usuario=SecurityContextHolder.getContext().getAuthentication().getName();
        db.jdbc().update("INSERT INTO comanda_reabertura(id,comanda_id,reaberta_em,reaberta_por,motivo,total_anterior) VALUES(?,?,?,?,?,?)",
            reaberturaId,id,db.ts(clock.instant()),usuario,motivo,row.get("total_fechamento"));
        db.jdbc().update("INSERT INTO pagamento_estornado(id,reabertura_id,pagamento_id,forma,valor,registrado_em,registrado_por) SELECT UUID(),?,id,forma,valor,registrado_em,registrado_por FROM pagamento WHERE comanda_id=?",
            reaberturaId,id);
        db.jdbc().update("DELETE FROM pagamento WHERE comanda_id=?",id);
        db.jdbc().update("UPDATE comanda SET status='ABERTA',fechada_em=NULL,atualizada_em=?,subtotal_fechamento=NULL,taxa_fechamento=NULL,total_fechamento=NULL WHERE id=?",db.ts(clock.instant()),id);
        return pedidos.comandaPorId(id);
    }
}
