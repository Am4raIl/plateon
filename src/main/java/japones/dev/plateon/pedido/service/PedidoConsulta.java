package japones.dev.plateon.pedido.service;

import japones.dev.plateon.compartilhado.Sql;
import japones.dev.plateon.compartilhado.Validar;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Component;
import static japones.dev.plateon.pedido.service.PedidoService.*;

/** Projeções de leitura: dois carregamentos em lote, independentemente do número de pedidos. */
@Component
@org.springframework.transaction.annotation.Transactional(readOnly=true)
public class PedidoConsulta {
    private final Sql db;
    public PedidoConsulta(Sql db) { this.db = db; }

    public PedidoView porId(String id) {
        return carregar(List.of(db.one("SELECT * FROM pedido WHERE id=?", id))).getFirst();
    }

    public PedidoView daMesa(String id, String mesaId) {
        return carregar(List.of(db.one("SELECT p.* FROM pedido p JOIN comanda c ON c.id=p.comanda_id WHERE p.id=? AND c.mesa_id=?", id, mesaId))).getFirst();
    }

    public List<PedidoView> dasComandas(List<String> ids) {
        if (ids.isEmpty()) return List.of();
        return carregar(db.jdbc().queryForList("SELECT * FROM pedido WHERE comanda_id IN (" + marcadores(ids.size()) + ") ORDER BY criado_em,id", ids.toArray()));
    }

    public List<PedidoView> carregar(List<Map<String,Object>> rows) {
        if (rows.isEmpty()) return List.of();
        Object[] ids = rows.stream().map(r -> r.get("id")).toArray();
        String in = marcadores(ids.length);
        var adicionais = new HashMap<String,List<AdicionalView>>();
        for (var a : db.jdbc().queryForList("SELECT a.* FROM item_adicional a JOIN item_pedido i ON i.id=a.item_pedido_id WHERE i.pedido_id IN (" + in + ") ORDER BY a.id", ids)) {
            adicionais.computeIfAbsent(db.str(a,"item_pedido_id"), k -> new ArrayList<>())
                .add(new AdicionalView(db.str(a,"adicional_id"), db.str(a,"nome"), Validar.dinheiro(a.get("preco"))));
        }
        var itens = new HashMap<String,List<ItemView>>();
        for (var i : db.jdbc().queryForList("SELECT * FROM item_pedido WHERE pedido_id IN (" + in + ") ORDER BY id", ids)) {
            var extras = List.copyOf(adicionais.getOrDefault(db.str(i,"id"), List.of()));
            BigDecimal unitario = Validar.dinheiro(i.get("preco_unitario"));
            int quantidade = ((Number)i.get("quantidade")).intValue();
            BigDecimal subtotal = extras.stream().map(AdicionalView::preco).reduce(unitario, BigDecimal::add)
                .multiply(BigDecimal.valueOf(quantidade));
            itens.computeIfAbsent(db.str(i,"pedido_id"), k -> new ArrayList<>()).add(new ItemView(
                db.str(i,"id"), db.str(i,"produto_id"), db.str(i,"nome_produto"), quantidade,
                db.str(i,"observacao"), unitario, db.str(i,"estacao"), extras, subtotal));
        }
        return rows.stream().map(r -> {
            var lista = List.copyOf(itens.getOrDefault(db.str(r,"id"), List.of()));
            Object dia = r.get("dia_operacional");
            return new PedidoView(db.str(r,"id"), db.str(r,"comanda_id"), db.str(r,"status"),
                r.get("numero_diario") == null ? null : ((Number)r.get("numero_diario")).intValue(),
                dia instanceof java.sql.Date d ? d.toLocalDate() : (LocalDate)dia,
                db.str(r,"observacao_geral"), db.instant(r,"criado_em"), db.instant(r,"enviado_em"),
                ((Number)r.get("version")).longValue(), lista,
                lista.stream().map(ItemView::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add));
        }).toList();
    }

    public static String marcadores(int tamanho) {
        return String.join(",", Collections.nCopies(tamanho, "?"));
    }
}
