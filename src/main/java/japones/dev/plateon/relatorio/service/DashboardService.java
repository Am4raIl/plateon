package japones.dev.plateon.relatorio.service;


import japones.dev.plateon.compartilhado.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {
    private final Sql db; private final Tempo tempo; private final Clock clock;
    @Value("${restaurante.fuso:America/Sao_Paulo}") private String fuso;
    @Value("${restaurante.hora-virada:04:00}") private String virada;
    @Value("${restaurante.atraso-margem-min:5}") private long margem;
    public DashboardService(Sql db,Tempo tempo,Clock clock) { this.db=db;this.tempo=tempo;this.clock=clock; }
    public record TopItem(String nome,long quantidade,BigDecimal receita) {}
    public record CategoriaValor(String categoria,BigDecimal receita) {}
    public record HoraValor(Integer hora,BigDecimal receita) {}
    public record FormaValor(String forma,BigDecimal valor) {}
    public record FechamentoDiario(LocalDate dia,BigDecimal totalVendido,long totalPedidos,long totalCancelados,
        BigDecimal valorCancelado,BigDecimal taxaServicoArrecadada,BigDecimal ticketMedioPorComanda,
        List<TopItem> top10Itens,List<CategoriaValor> vendasPorCategoria,List<HoraValor> vendasPorHora,
        BigDecimal tempoMedioPreparoMin,BigDecimal tempoMedioEntregaMin,long pedidosAtrasados,
        List<FormaValor> vendasPorFormaPagamento) {}
    public FechamentoDiario diario(LocalDate dia) {
        if(dia==null) dia=tempo.diaOperacional(clock.instant());
        var inicio=dia.atTime(LocalTime.parse(virada)).atZone(ZoneId.of(fuso)).toInstant();
        var fim=dia.plusDays(1).atTime(LocalTime.parse(virada)).atZone(ZoneId.of(fuso)).toInstant();
        Object total=db.jdbc().queryForObject("SELECT COALESCE(SUM((i.preco_unitario + COALESCE((SELECT SUM(ia.preco) FROM item_adicional ia WHERE ia.item_pedido_id=i.id),0))*i.quantidade),0) FROM item_pedido i JOIN pedido p ON p.id=i.pedido_id WHERE p.dia_operacional=? AND p.status<>'CANCELADO'",Object.class,dia);
        Object cancelados=db.jdbc().queryForObject("SELECT COUNT(*) FROM pedido WHERE dia_operacional=? AND status='CANCELADO'",Object.class,dia);
        Object valorCancelado=db.jdbc().queryForObject("SELECT COALESCE(SUM((i.preco_unitario + COALESCE((SELECT SUM(ia.preco) FROM item_adicional ia WHERE ia.item_pedido_id=i.id),0))*i.quantidade),0) FROM item_pedido i JOIN pedido p ON p.id=i.pedido_id WHERE p.dia_operacional=? AND p.status='CANCELADO'",Object.class,dia);
        Object pedidos=db.jdbc().queryForObject("SELECT COUNT(*) FROM pedido WHERE dia_operacional=? AND status<>'CANCELADO'",Object.class,dia);
        Object taxa=db.jdbc().queryForObject("SELECT COALESCE(SUM((SELECT COALESCE(SUM((i.preco_unitario + COALESCE((SELECT SUM(ia.preco) FROM item_adicional ia WHERE ia.item_pedido_id=i.id),0))*i.quantidade),0) FROM item_pedido i JOIN pedido p ON p.id=i.pedido_id WHERE p.comanda_id=c.id AND p.status<>'CANCELADO')*c.taxa_servico_percentual/100),0) FROM comanda c WHERE c.status='PAGA' AND c.fechada_em>=? AND c.fechada_em<?",Object.class,db.ts(inicio),db.ts(fim));
        var top=db.jdbc().queryForList("SELECT i.nome_produto AS nome, SUM(i.quantidade) AS quantidade, SUM((i.preco_unitario+COALESCE((SELECT SUM(ia.preco) FROM item_adicional ia WHERE ia.item_pedido_id=i.id),0))*i.quantidade) AS receita FROM item_pedido i JOIN pedido p ON p.id=i.pedido_id WHERE p.dia_operacional=? AND p.status<>'CANCELADO' GROUP BY i.nome_produto ORDER BY quantidade DESC LIMIT 10",dia);
        var categorias=db.jdbc().queryForList("SELECT pr.categoria, SUM((i.preco_unitario+COALESCE((SELECT SUM(ia.preco) FROM item_adicional ia WHERE ia.item_pedido_id=i.id),0))*i.quantidade) AS receita FROM item_pedido i JOIN pedido p ON p.id=i.pedido_id JOIN produto pr ON pr.id=i.produto_id WHERE p.dia_operacional=? AND p.status<>'CANCELADO' GROUP BY pr.categoria",dia);
        var horas=db.jdbc().queryForList("SELECT HOUR(CONVERT_TZ(p.enviado_em,'+00:00',?)) AS hora, SUM((i.preco_unitario+COALESCE((SELECT SUM(ia.preco) FROM item_adicional ia WHERE ia.item_pedido_id=i.id),0))*i.quantidade) AS receita FROM pedido p JOIN item_pedido i ON i.pedido_id=p.id WHERE p.dia_operacional=? AND p.status<>'CANCELADO' GROUP BY HOUR(CONVERT_TZ(p.enviado_em,'+00:00',?)) ORDER BY hora",fuso,dia,fuso);
        var formas=db.jdbc().queryForList("SELECT forma,SUM(valor) AS valor FROM pagamento pa JOIN comanda c ON c.id=pa.comanda_id WHERE c.fechada_em>=? AND c.fechada_em<? GROUP BY forma",db.ts(inicio),db.ts(fim));
        Object preparo=db.jdbc().queryForObject("SELECT AVG(TIMESTAMPDIFF(SECOND,r.em,pr.em)/60.0) FROM pedido p JOIN pedido_status_historico r ON r.pedido_id=p.id AND r.para='RECEBIDO' JOIN pedido_status_historico pr ON pr.pedido_id=p.id AND pr.para='PRONTO' WHERE p.dia_operacional=?",Object.class,dia);
        Object entrega=db.jdbc().queryForObject("SELECT AVG(TIMESTAMPDIFF(SECOND,pr.em,e.em)/60.0) FROM pedido p JOIN pedido_status_historico pr ON pr.pedido_id=p.id AND pr.para='PRONTO' JOIN pedido_status_historico e ON e.pedido_id=p.id AND e.para='ENTREGUE' WHERE p.dia_operacional=?",Object.class,dia);
        Object atrasados=db.jdbc().queryForObject("SELECT COUNT(*) FROM pedido p WHERE p.dia_operacional=? AND p.status IN ('RECEBIDO','EM_PREPARO') AND TIMESTAMPDIFF(MINUTE,p.enviado_em,?) > COALESCE((SELECT MAX(pr.tempo_preparo_estimado_min) FROM item_pedido i JOIN produto pr ON pr.id=i.produto_id WHERE i.pedido_id=p.id),0)+?",Object.class,dia,db.ts(clock.instant()),margem);
        Object comandaMedia=db.jdbc().queryForObject("SELECT COALESCE(AVG(c.couvert + (SELECT COALESCE(SUM((i.preco_unitario+COALESCE((SELECT SUM(ia.preco) FROM item_adicional ia WHERE ia.item_pedido_id=i.id),0))*i.quantidade),0) FROM item_pedido i JOIN pedido p ON p.id=i.pedido_id WHERE p.comanda_id=c.id AND p.status<>'CANCELADO')*(1+c.taxa_servico_percentual/100)),0) FROM comanda c WHERE c.status='PAGA' AND c.fechada_em>=? AND c.fechada_em<?",Object.class,db.ts(inicio),db.ts(fim));
        return new FechamentoDiario(dia,decimal(total),number(pedidos),number(cancelados),decimal(valorCancelado),
            decimal(taxa),decimal(comandaMedia),
            top.stream().map(r -> new TopItem(db.str(r,"nome"),number(r.get("quantidade")),decimal(r.get("receita")))).toList(),
            categorias.stream().map(r -> new CategoriaValor(db.str(r,"categoria"),decimal(r.get("receita")))).toList(),
            horas.stream().map(r -> new HoraValor(r.get("hora")==null ? null : ((Number)r.get("hora")).intValue(),decimal(r.get("receita")))).toList(),
            decimal(preparo),decimal(entrega),number(atrasados),
            formas.stream().map(r -> new FormaValor(db.str(r,"forma"),decimal(r.get("valor")))).toList());
    }
    private BigDecimal decimal(Object value) { return value==null ? null : new BigDecimal(value.toString()); }
    private long number(Object value) { return ((Number)value).longValue(); }
}
