package japones.dev.plateon.pedido.service;

import japones.dev.plateon.pedido.service.PedidoService;
import japones.dev.plateon.pedido.service.PedidoEventos;

import japones.dev.plateon.compartilhado.*;
import japones.dev.plateon.conta.service.ComandaRegras;
import jakarta.validation.constraints.NotBlank;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KanbanService {
    private final Sql db; private final Clock clock; private final PedidoService pedidos; private final ApplicationEventPublisher events;
    private final PedidoConsulta consultas;
    private final ComandaRegras regras;
    @Value("${restaurante.atraso-margem-min:5}") private long margem;
    public KanbanService(Sql db,Clock clock,PedidoService pedidos,ApplicationEventPublisher events,PedidoConsulta consultas,ComandaRegras regras) {
        this.db=db;this.clock=clock;this.pedidos=pedidos;this.events=events;
        this.consultas=consultas;this.regras=regras;
    }
    public record Cartao(PedidoService.PedidoView pedido,int numeroMesa,long minutosDecorridos,boolean atrasado) {}
    public record Kanban(List<Cartao> recebido,List<Cartao> emPreparo,List<Cartao> pronto) {}
    public record Transicao(@NotBlank String novoStatus,String motivo,long versao) {}
    public Kanban listar(String estacao) {
        Validar.exigir(estacao==null || Set.of("COZINHA","BAR").contains(estacao),HttpStatus.BAD_REQUEST,"Estação inválida");
        String sql="SELECT p.*,m.numero,(SELECT MAX(pr.tempo_preparo_estimado_min) FROM item_pedido i JOIN produto pr ON pr.id=i.produto_id WHERE i.pedido_id=p.id) AS preparo_maximo FROM pedido p JOIN comanda c ON c.id=p.comanda_id JOIN mesa m ON m.id=c.mesa_id WHERE p.status IN ('RECEBIDO','EM_PREPARO','PRONTO')";
        if(estacao!=null) sql+=" AND EXISTS (SELECT 1 FROM item_pedido i WHERE i.pedido_id=p.id AND i.estacao=?)";
        sql+=" ORDER BY p.enviado_em,p.id";
        var rows=estacao==null ? db.jdbc().queryForList(sql) : db.jdbc().queryForList(sql,estacao);
        var lista=consultas.carregar(rows);
        var cards=new ArrayList<Cartao>();
        for(int n=0;n<rows.size();n++) {
            var row=rows.get(n);
            var pedido=lista.get(n);
            long minutos=Duration.between(db.instant(row,"enviado_em"),clock.instant()).toMinutes();
            Integer max=row.get("preparo_maximo")==null ? null : ((Number)row.get("preparo_maximo")).intValue();
            boolean atrasado=!pedido.status().equals("PRONTO") && minutos>(max==null ? 0 : max)+margem;
            cards.add(new Cartao(pedido,((Number)row.get("numero")).intValue(),minutos,atrasado));
        }
        return new Kanban(cards.stream().filter(c -> c.pedido.status().equals("RECEBIDO")).toList(),
            cards.stream().filter(c -> c.pedido.status().equals("EM_PREPARO")).toList(),
            cards.stream().filter(c -> c.pedido.status().equals("PRONTO")).toList());
    }
    public static List<String> permitidas(String status) {
        return switch(status) {
            case "RASCUNHO" -> List.of("RECEBIDO");
            case "RECEBIDO" -> List.of("EM_PREPARO","CANCELADO");
            case "EM_PREPARO" -> List.of("PRONTO","CANCELADO");
            case "PRONTO" -> List.of("ENTREGUE","CANCELADO");
            default -> List.of();
        };
    }
    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED) public PedidoService.PedidoView transicao(String id,Transicao input) {
        var bloqueado=regras.bloquearPedido(id,null);
        var row=bloqueado.pedido();
        String atual=db.str(row,"status"), novo=input.novoStatus();
        long versao=((Number)row.get("version")).longValue();
        var details=Map.<String,Object>of("estadoAtual",atual,"transicoesPermitidas",permitidas(atual));
        if(versao!=input.versao()) throw new ApiException(HttpStatus.CONFLICT,"Versão desatualizada",details);
        boolean gerente=SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_GERENTE"));
        boolean avancar=permitidas(atual).contains(novo);
        boolean retroceder=gerente && List.of("RECEBIDO","EM_PREPARO","PRONTO","ENTREGUE").contains(atual)
            && List.of("RECEBIDO","EM_PREPARO","PRONTO").contains(novo)
            && ordem(novo)<ordem(atual);
        if(novo.equals("CANCELADO") || retroceder) regras.exigirAberta(bloqueado.statusComanda());
        Validar.exigir(Set.of("ABERTA","AGUARDANDO_PAGAMENTO","PAGA").contains(bloqueado.statusComanda()),HttpStatus.CONFLICT,"Comanda encerrada");
        if(!avancar && !retroceder) throw new ApiException(HttpStatus.CONFLICT,"Transição inválida",details);
        if((novo.equals("CANCELADO") || retroceder) && (input.motivo()==null || input.motivo().isBlank()))
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,"Motivo obrigatório");
        if(novo.equals("CANCELADO") && atual.equals("RECEBIDO") && !gerente)
            throw new ApiException(HttpStatus.FORBIDDEN,"Cancelamento nesta etapa exige gerente");
        String usuario=SecurityContextHolder.getContext().getAuthentication().getName();
        db.jdbc().update("UPDATE pedido SET status=?,version=version+1 WHERE id=? AND version=?",novo,id,versao);
        db.jdbc().update("INSERT INTO pedido_status_historico(pedido_id,de,para,em,usuario_id,motivo) VALUES(?,?,?,?,?,?)",
            id,atual,novo,db.ts(clock.instant()),usuario,input.motivo());
        events.publishEvent(new PedidoEventos.Evento(id,novo));
        return pedidos.pedidoAdmin(id);
    }
    private int ordem(String status) { return List.of("RECEBIDO","EM_PREPARO","PRONTO","ENTREGUE").indexOf(status); }
}
