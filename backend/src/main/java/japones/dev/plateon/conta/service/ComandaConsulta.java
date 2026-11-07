package japones.dev.plateon.conta.service;

import japones.dev.plateon.compartilhado.Sql;
import japones.dev.plateon.compartilhado.Validar;
import japones.dev.plateon.pedido.service.PedidoConsulta;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import static japones.dev.plateon.pedido.service.PedidoService.*;

@Component
@org.springframework.transaction.annotation.Transactional(readOnly=true)
public class ComandaConsulta {
    private final Sql db;
    private final PedidoConsulta pedidos;
    public ComandaConsulta(Sql db, PedidoConsulta pedidos) { this.db = db; this.pedidos = pedidos; }

    public record Resumo(String id,String status,int numeroMesa,Instant abertaEm,
        BigDecimal subtotal,BigDecimal taxaServico,BigDecimal total) {}

    public List<Resumo> resumosPorIds(List<String> ids) {
        if(ids.isEmpty()) return List.of();
        var rows=db.jdbc().queryForList("""
            SELECT c.*,m.numero,COALESCE((
              SELECT SUM((i.preco_unitario+COALESCE((SELECT SUM(a.preco) FROM item_adicional a WHERE a.item_pedido_id=i.id),0))*i.quantidade)
              FROM pedido p JOIN item_pedido i ON i.pedido_id=p.id
              WHERE p.comanda_id=c.id AND p.status NOT IN ('RASCUNHO','CANCELADO')
            ),0) AS subtotal_atual
            FROM comanda c JOIN mesa m ON m.id=c.mesa_id WHERE c.id IN (
            """+PedidoConsulta.marcadores(ids.size())+")",ids.toArray());
        var porId=new HashMap<String,Resumo>();
        for(var r:rows) {
            var valores=valores(r,Validar.dinheiro(r.get("subtotal_atual")));
            var resumo=new Resumo(db.str(r,"id"),db.str(r,"status"),((Number)r.get("numero")).intValue(),
                db.instant(r,"aberta_em"),valores.subtotal(),valores.taxa(),valores.total());
            porId.put(resumo.id(),resumo);
        }
        return ids.stream().map(porId::get).toList();
    }

    public ComandaView atual(String mesaId) {
        var row = db.optional("SELECT c.*,m.numero FROM comanda c JOIN mesa m ON m.id=c.mesa_id WHERE c.mesa_id=? AND c.status IN ('ABERTA','AGUARDANDO_PAGAMENTO') ORDER BY c.aberta_em DESC LIMIT 1", mesaId);
        return row == null ? null : carregar(List.of(row)).getFirst();
    }

    public ComandaView porId(String id) {
        return carregar(List.of(db.one("SELECT c.*,m.numero FROM comanda c JOIN mesa m ON m.id=c.mesa_id WHERE c.id=?", id))).getFirst();
    }

    public List<ComandaView> porIds(List<String> ids) {
        if (ids.isEmpty()) return List.of();
        var rows = db.jdbc().queryForList("SELECT c.*,m.numero FROM comanda c JOIN mesa m ON m.id=c.mesa_id WHERE c.id IN (" + PedidoConsulta.marcadores(ids.size()) + ")", ids.toArray());
        var porId = carregar(rows).stream().collect(Collectors.toMap(ComandaView::id, c -> c));
        return ids.stream().map(porId::get).toList();
    }

    private List<ComandaView> carregar(List<Map<String,Object>> rows) {
        var porComanda = pedidos.dasComandas(rows.stream().map(r -> db.str(r,"id")).toList()).stream()
            .collect(Collectors.groupingBy(PedidoView::comandaId));
        return rows.stream().map(r -> {
            var lista = porComanda.getOrDefault(db.str(r,"id"), List.of());
            BigDecimal percentual = Validar.dinheiro(r.get("taxa_servico_percentual"));
            BigDecimal couvert = Validar.dinheiro(r.get("couvert"));
            BigDecimal subtotal = lista.stream().filter(p -> !Set.of("CANCELADO","RASCUNHO").contains(p.status()))
                .map(PedidoView::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            var valores=valores(r,subtotal);
            return new ComandaView(db.str(r,"id"), db.str(r,"status"), ((Number)r.get("numero")).intValue(),
                db.instant(r,"aberta_em"), percentual, couvert, List.copyOf(lista), valores.subtotal(), valores.taxa(), valores.total());
        }).toList();
    }

    private record Valores(BigDecimal subtotal,BigDecimal taxa,BigDecimal total) {}
    private Valores valores(Map<String,Object> r,BigDecimal subtotal) {
        if(r.get("total_fechamento")!=null) return new Valores(Validar.dinheiro(r.get("subtotal_fechamento")),
            Validar.dinheiro(r.get("taxa_fechamento")),Validar.dinheiro(r.get("total_fechamento")));
        var taxa=subtotal.multiply(Validar.dinheiro(r.get("taxa_servico_percentual"))).divide(new BigDecimal("100"),2,RoundingMode.HALF_UP);
        return new Valores(subtotal,taxa,subtotal.add(taxa).add(Validar.dinheiro(r.get("couvert"))));
    }
}
