package japones.dev.plateon;

import japones.dev.plateon.compartilhado.*;
import japones.dev.plateon.conta.service.*;
import japones.dev.plateon.pedido.service.*;
import japones.dev.plateon.relatorio.service.DashboardService;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.mysql.MySQLContainer;
import static org.junit.jupiter.api.Assertions.*;

class ConfiabilidadeIntegrationTest {
    static MySQLContainer mysql;
    static ConfigurableApplicationContext context;
    static Sql db;
    static PedidoService pedidos;
    static ContaService contas;
    static KanbanService kanban;
    static UsernamePasswordAuthenticationToken gerente;
    static String produto;
    static AtomicInteger numeroMesa=new AtomicInteger(20000);

    @BeforeAll static void iniciar() {
        String url=System.getenv("PLATEON_RELIABILITY_TEST_JDBC");
        if(url==null) {
            Assumptions.assumeTrue(DockerClientFactory.instance().isDockerAvailable(),"Docker indisponível");
            mysql=new MySQLContainer("mysql:8.4"); mysql.start(); url=mysql.getJdbcUrl();
        }
        context=new SpringApplicationBuilder(PlateonApplication.class).run(
            "--spring.datasource.url="+TestMysqlUrl.utc(url),
            "--spring.datasource.username="+(mysql==null ? "plateon" : mysql.getUsername()),
            "--spring.datasource.password="+(mysql==null ? "plateon" : mysql.getPassword()),
            "--restaurante.jwt.segredo=integration_test_secret_32_characters_long",
            "--server.port=0");
        db=context.getBean(Sql.class); pedidos=context.getBean(PedidoService.class);
        contas=context.getBean(ContaService.class); kanban=context.getBean(KanbanService.class);
        produto=db.str(db.one("SELECT id FROM produto WHERE nome='X-Burger'"),"id");
        String usuario=db.id();
        db.jdbc().update("INSERT INTO usuario(id,nome,username,senha_hash,papel,ativo) VALUES(?,'Regressão','regressao','hash','GERENTE',1)",usuario);
        gerente=new UsernamePasswordAuthenticationToken(usuario,null,List.of(new SimpleGrantedAuthority("ROLE_GERENTE")));
    }
    @AfterAll static void encerrar() {
        if(context!=null) context.close();
        if(mysql!=null) mysql.stop();
    }
    @BeforeEach void autenticar() { SecurityContextHolder.getContext().setAuthentication(gerente); }
    @AfterEach void limparAutenticacao() { SecurityContextHolder.clearContext(); }

    private String mesa() {
        String id=db.id();
        db.jdbc().update("INSERT INTO mesa(id,numero,capacidade,ativa) VALUES(?,?,4,1)",id,numeroMesa.incrementAndGet());
        return id;
    }
    private PedidoService.PedidoView rascunho(String mesa) {
        var pedido=pedidos.rascunho(mesa);
        return pedidos.adicionar(mesa,pedido.id(),new PedidoService.ItemInput(produto,1,null,Set.of()));
    }
    private ContaService.Fechamento pagamento(BigDecimal total,boolean forcar) {
        return new ContaService.Fechamento(List.of(new ContaService.PagamentoInput("PIX",total,null)),false,forcar);
    }
    private void conflito(org.junit.jupiter.api.function.Executable acao) {
        assertEquals(HttpStatus.CONFLICT,assertThrows(ApiException.class,acao).status());
    }

    @Test void fechamentoForcadoDescartaRascunhoEPreservaValoresAteEntrega() {
        String mesa=mesa();
        var enviado=pedidos.enviar(mesa,rascunho(mesa).id(),null);
        var draft=rascunho(mesa);
        var antes=pedidos.comandaAtual(mesa);
        var fechado=contas.fechar(antes.id(),pagamento(antes.total(),true)).comanda();
        assertEquals("PAGA",fechado.status());
        assertEquals("CANCELADO",pedidos.pedidoAdmin(draft.id()).status());
        assertEquals("CANCELADO",pedidos.enviar(mesa,draft.id(),null).status());
        assertNull(pedidos.pedidoAdmin(draft.id()).numeroDiario());
        conflito(() -> pedidos.adicionar(mesa,draft.id(),new PedidoService.ItemInput(produto,1,null,Set.of())));
        conflito(() -> pedidos.cancelar(mesa,enviado.id()));
        conflito(() -> kanban.transicao(enviado.id(),new KanbanService.Transicao("CANCELADO","Após pagamento",enviado.versao())));
        var atual=enviado;
        for(String status:List.of("EM_PREPARO","PRONTO","ENTREGUE"))
            atual=kanban.transicao(atual.id(),new KanbanService.Transicao(status,null,atual.versao()));
        var entregue=atual;
        conflito(() -> kanban.transicao(entregue.id(),new KanbanService.Transicao("PRONTO","Retorno",entregue.versao())));
        assertEquals(fechado.total(),pedidos.comandaPorId(antes.id()).total());
        assertEquals(fechado.total(),db.jdbc().queryForObject("SELECT SUM(valor) FROM pagamento WHERE comanda_id=?",BigDecimal.class,antes.id()));
        var novo=pedidos.rascunho(mesa);
        assertNotEquals(antes.id(),novo.comandaId());
        // Mesmo diante de uma alteração externa nos itens, o fechamento continua imutável.
        db.jdbc().update("UPDATE item_pedido SET preco_unitario=99 WHERE pedido_id=?",enviado.id());
        assertEquals(fechado.total(),pedidos.comandaPorId(antes.id()).total());
    }

    @Test void aguardandoPagamentoBloqueiaAlteracoesSemImpedirEntrega() {
        String mesa=mesa();
        var enviado=pedidos.enviar(mesa,rascunho(mesa).id(),null);
        var draft=rascunho(mesa);
        var conta=pedidos.comandaAtual(mesa);
        contas.fechar(conta.id(),new ContaService.Fechamento(List.of(),false,true));
        conflito(() -> pedidos.rascunho(mesa));
        conflito(() -> pedidos.enviar(mesa,draft.id(),null));
        conflito(() -> pedidos.alterarItem(mesa,draft.id(),draft.itens().getFirst().id(),new PedidoService.ItemInput(produto,2,null,Set.of())));
        conflito(() -> pedidos.removerItem(mesa,draft.id(),draft.itens().getFirst().id()));
        String enviadoId=enviado.id();
        conflito(() -> pedidos.cancelar(mesa,enviadoId));
        for(String status:List.of("EM_PREPARO","PRONTO","ENTREGUE"))
            enviado=kanban.transicao(enviado.id(),new KanbanService.Transicao(status,null,enviado.versao()));
        assertEquals("PAGA",contas.fechar(conta.id(),pagamento(conta.total(),true)).comanda().status());
    }

    @Test void pagamentoInvalidoReverteTodoFechamento() {
        String mesa=mesa();
        pedidos.enviar(mesa,rascunho(mesa).id(),null);
        var draft=rascunho(mesa);
        var conta=pedidos.comandaAtual(mesa);
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY,assertThrows(ApiException.class,
            () -> contas.fechar(conta.id(),pagamento(BigDecimal.ONE,true))).status());
        assertEquals("ABERTA",pedidos.comandaAtual(mesa).status());
        assertEquals("RASCUNHO",pedidos.pedidoAdmin(draft.id()).status());
        assertNull(db.one("SELECT total_fechamento FROM comanda WHERE id=?",conta.id()).get("total_fechamento"));
        assertEquals(0,db.jdbc().queryForObject("SELECT COUNT(*) FROM pagamento WHERE comanda_id=?",Integer.class,conta.id()));
    }

    @Test void envioConcorrenteComFechamentoNaoProduzContaPagaDivergente() throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            for(int n=0;n<8;n++) {
                String mesa=mesa();
                pedidos.enviar(mesa,rascunho(mesa).id(),null);
                var draft=rascunho(mesa);
                var conta=pedidos.comandaAtual(mesa);
                var gate=new CountDownLatch(1);
                var envio=pool.submit(() -> { gate.await(); return pedidos.enviar(mesa,draft.id(),null); });
                var fechamento=pool.submit(() -> {
                    SecurityContextHolder.getContext().setAuthentication(gerente);
                    try {
                        gate.await();
                        try { contas.fechar(conta.id(),pagamento(conta.total(),true)); return true; }
                        catch(ApiException ex) { assertEquals(HttpStatus.UNPROCESSABLE_ENTITY,ex.status()); return false; }
                    } finally { SecurityContextHolder.clearContext(); }
                });
                gate.countDown();
                var resultadoEnvio=envio.get(15,TimeUnit.SECONDS);
                boolean pagou=fechamento.get(15,TimeUnit.SECONDS);
                var atual=pedidos.comandaPorId(conta.id());
                if(pagou) {
                    assertEquals("PAGA",atual.status());
                    assertEquals("CANCELADO",resultadoEnvio.status());
                    assertEquals(atual.total(),db.jdbc().queryForObject("SELECT SUM(valor) FROM pagamento WHERE comanda_id=?",BigDecimal.class,atual.id()));
                } else {
                    assertEquals("ABERTA",atual.status());
                    assertEquals("RECEBIDO",resultadoEnvio.status());
                    assertEquals(conta.total().multiply(BigDecimal.valueOf(2)),atual.total());
                }
            }
        }
    }

    @Test void categoriaHistoricaEMediasNaoMudamComReclassificacaoERetrocessos() {
        String mesa=mesa();
        var enviado=pedidos.enviar(mesa,rascunho(mesa).id(),null);
        var dia=LocalDate.of(2025,6,3);
        var base=Instant.parse("2025-06-03T15:00:00Z");
        db.jdbc().update("UPDATE pedido SET dia_operacional=?,enviado_em=?,status='ENTREGUE' WHERE id=?",dia,db.ts(base),enviado.id());
        db.jdbc().update("UPDATE pedido_status_historico SET em=? WHERE pedido_id=?",db.ts(base),enviado.id());
        String anterior="RECEBIDO";
        String[] estados={"PRONTO","RECEBIDO","PRONTO","ENTREGUE","PRONTO","ENTREGUE"};
        int[] minutos={10,12,20,25,27,30};
        for(int n=0;n<estados.length;n++) {
            db.jdbc().update("INSERT INTO pedido_status_historico(pedido_id,de,para,em) VALUES(?,?,?,?)",enviado.id(),anterior,estados[n],db.ts(base.plusSeconds(minutos[n]*60L)));
            anterior=estados[n];
        }
        db.jdbc().update("UPDATE produto SET categoria='PORCOES' WHERE id=?",produto);
        try {
            var dashboard=context.getBean(DashboardService.class).diario(dia);
            assertEquals("HAMBURGUERES",dashboard.vendasPorCategoria().getFirst().categoria());
            assertEquals(0,new BigDecimal("15").compareTo(dashboard.tempoMedioPreparoMin()));
            assertEquals(0,new BigDecimal("3").compareTo(dashboard.tempoMedioEntregaMin()));
        } finally { db.jdbc().update("UPDATE produto SET categoria='HAMBURGUERES' WHERE id=?",produto); }
    }

    static class JdbcContador extends JdbcTemplate {
        int consultas;
        JdbcContador(DataSource source) { super(source); }
        @Override public List<Map<String,Object>> queryForList(String sql,Object... args) {
            consultas++; return super.queryForList(sql,args);
        }
    }

    @Test void carregamentoEmLotePreservaDetalhesComNumeroConstanteDeConsultas() {
        var ids=new ArrayList<String>();
        String cheddar=db.str(db.one("SELECT id FROM adicional WHERE nome='Cheddar'"),"id");
        for(int n=0;n<4;n++) {
            String mesa=mesa();
            var pedido=rascunho(mesa);
            pedidos.adicionar(mesa,pedido.id(),new PedidoService.ItemInput(produto,2,null,Set.of(cheddar)));
            pedidos.enviar(mesa,pedido.id(),null);
            ids.add(pedido.comandaId());
        }
        var jdbc=new JdbcContador(context.getBean(DataSource.class));
        var sql=new Sql(jdbc);
        var consulta=new ComandaConsulta(sql,new PedidoConsulta(sql));
        var comandas=consulta.porIds(ids);
        assertEquals(4,jdbc.consultas);
        assertEquals(ids,comandas.stream().map(PedidoService.ComandaView::id).toList());
        assertTrue(comandas.stream().allMatch(c -> c.pedidos().getFirst().itens().size()==2));
        assertTrue(comandas.stream().allMatch(c -> c.pedidos().getFirst().itens().stream().anyMatch(i -> !i.adicionais().isEmpty())));
        jdbc.consultas=0;
        var resumos=consulta.resumosPorIds(ids);
        assertEquals(1,jdbc.consultas);
        assertEquals(comandas.stream().map(PedidoService.ComandaView::total).toList(),resumos.stream().map(ComandaConsulta.Resumo::total).toList());
        jdbc.consultas=0;
        var kds=new KanbanService(sql,Clock.systemUTC(),pedidos,context,new PedidoConsulta(sql),context.getBean(ComandaRegras.class));
        assertFalse(kds.listar("COZINHA").recebido().isEmpty());
        assertEquals(3,jdbc.consultas);
    }
}
