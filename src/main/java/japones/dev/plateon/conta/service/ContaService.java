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
    public record Fechamento(List<@Valid PagamentoInput> pagamentos,boolean removerTaxa,boolean forcar) {}
    public record FechamentoView(PedidoService.ComandaView comanda,BigDecimal troco) {}
    private boolean gerente() { return SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_GERENTE")); }
    private void caixa() {
        boolean autorizado=SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
            .anyMatch(a -> Set.of("ROLE_CAIXA","ROLE_GERENTE").contains(a.getAuthority()));
        Validar.exigir(autorizado,HttpStatus.FORBIDDEN,"Permissão de caixa necessária");
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
        caixa(); var row=db.one("SELECT * FROM comanda WHERE id=? FOR UPDATE",id);
        Validar.exigir(Set.of("ABERTA","AGUARDANDO_PAGAMENTO").contains(db.str(row,"status")),HttpStatus.CONFLICT,"Comanda não está aberta");
        var pendentes=db.jdbc().queryForList("SELECT status FROM pedido WHERE comanda_id=? AND status NOT IN ('ENTREGUE','CANCELADO')",id);
        Validar.exigir(pendentes.isEmpty() || input.forcar() && gerente(),HttpStatus.CONFLICT,"Ainda existem pedidos não entregues");
        if(input.removerTaxa()) db.jdbc().update("UPDATE comanda SET taxa_servico_percentual=0 WHERE id=?",id);
        db.jdbc().update("UPDATE comanda SET status='AGUARDANDO_PAGAMENTO' WHERE id=?",id);
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
        db.jdbc().update("UPDATE comanda SET status='PAGA',fechada_em=?,subtotal_fechamento=?,taxa_fechamento=?,total_fechamento=? WHERE id=?",
            db.ts(clock.instant()),valores.subtotal(),valores.taxaServico(),total,id);
        for(var rascunho:rascunhos) events.publishEvent(new japones.dev.plateon.pedido.service.PedidoEventos.Evento(db.str(rascunho,"id"),"CANCELADO"));
        return new FechamentoView(pedidos.comandaPorId(id),troco);
    }
}
