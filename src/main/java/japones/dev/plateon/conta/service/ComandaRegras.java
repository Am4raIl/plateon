package japones.dev.plateon.conta.service;

import japones.dev.plateon.compartilhado.Sql;
import japones.dev.plateon.compartilhado.Validar;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Toda mutação de pedido bloqueia primeiro a comanda, depois o pedido. */
@Component
public class ComandaRegras {
    private final Sql db;

    public ComandaRegras(Sql db) { this.db = db; }

    public record PedidoBloqueado(Map<String,Object> pedido, String statusComanda) {}

    public PedidoBloqueado bloquearPedido(String pedidoId, String mesaId) {
        var origem = mesaId == null
            ? db.one("SELECT comanda_id FROM pedido WHERE id=?", pedidoId)
            : db.one("SELECT p.comanda_id FROM pedido p JOIN comanda c ON c.id=p.comanda_id WHERE p.id=? AND c.mesa_id=?", pedidoId, mesaId);
        var comanda = db.one("SELECT status FROM comanda WHERE id=? FOR UPDATE", origem.get("comanda_id"));
        var pedido = db.one("SELECT * FROM pedido WHERE id=? FOR UPDATE", pedidoId);
        return new PedidoBloqueado(pedido, db.str(comanda, "status"));
    }

    public void exigirAberta(String status) {
        Validar.exigir("ABERTA".equals(status), HttpStatus.CONFLICT,
            "A comanda não aceita alterações financeiras");
    }
}
