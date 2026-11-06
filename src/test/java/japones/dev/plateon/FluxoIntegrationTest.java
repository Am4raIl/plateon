package japones.dev.plateon;

import japones.dev.plateon.compartilhado.*;
import japones.dev.plateon.cardapio.domain.AdicionalPolicy;
import japones.dev.plateon.dispositivo.service.DispositivoService;
import japones.dev.plateon.dispositivo.domain.*;
import japones.dev.plateon.cardapio.domain.*;
import japones.dev.plateon.conta.domain.*;
import japones.dev.plateon.mesa.domain.*;
import japones.dev.plateon.usuario.domain.*;
import japones.dev.plateon.pedido.domain.*;
import japones.dev.plateon.pedido.service.*;
import japones.dev.plateon.conta.service.ContaService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.mysql.MySQLContainer;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.IntStream;
import org.springframework.transaction.PlatformTransactionManager;
import jakarta.persistence.EntityManagerFactory;
import static org.junit.jupiter.api.Assertions.*;

class FluxoIntegrationTest {
    @Test void fluxoNumeracaoConcorrentePrecoEFechamento() throws Exception {
        String external=System.getenv("PLATEON_TEST_JDBC");
        MySQLContainer mysql=null;
        if(external==null) {
            Assumptions.assumeTrue(DockerClientFactory.instance().isDockerAvailable(),"Docker indisponível");
            mysql=new MySQLContainer("mysql:8.4"); mysql.start(); external=mysql.getJdbcUrl();
        }
        String username=mysql==null ? "plateon" : mysql.getUsername();
        String password=mysql==null ? "plateon" : mysql.getPassword();
        try(var context=new SpringApplicationBuilder(PlateonApplication.class)
                .run("--spring.datasource.url="+TestMysqlUrl.utc(external),"--spring.datasource.username="+username,
                    "--spring.datasource.password="+password,
                    "--restaurante.jwt.segredo=integration_test_secret_32_characters_long",
                    "--restaurante.seed.referencia=true","--server.port=0")) {
            var db=context.getBean(Sql.class);
            var dispositivos=context.getBean(DispositivoService.class);
            var pedidos=context.getBean(PedidoService.class);
            var kanban=context.getBean(KanbanService.class);
            var contas=context.getBean(ContaService.class);
            String mesa=db.str(db.one("SELECT id FROM mesa WHERE numero=1"),"id");
            String outraMesa=db.str(db.one("SELECT id FROM mesa WHERE numero=2"),"id");
            var solicitacao=dispositivos.solicitar();
            var aprovado=dispositivos.aprovar(new DispositivoService.Aprovar(solicitacao.codigo(),mesa));
            assertNotNull(dispositivos.consultar(solicitacao.solicitacaoId()).token());
            assertEquals(HttpStatus.GONE,assertThrows(ApiException.class,() -> dispositivos.consultar(solicitacao.solicitacaoId())).status());
            String produto=db.str(db.one("SELECT id FROM produto WHERE nome='X-Burger'"),"id");
            var draft=pedidos.rascunho(mesa);
            pedidos.adicionar(mesa,draft.id(),new PedidoService.ItemInput(produto,1,null,Set.of()));
            var sent=pedidos.enviar(mesa,draft.id(),new PedidoService.Envio("teste"));
            assertEquals(sent.numeroDiario(),pedidos.enviar(mesa,draft.id(),new PedidoService.Envio("reenvio")).numeroDiario());
            assertEquals(new BigDecimal("16.00"),sent.subtotal());
            assertEquals(HttpStatus.NOT_FOUND,assertThrows(ApiException.class,() -> pedidos.pedido(draft.id(),outraMesa)).status());
            db.jdbc().update("UPDATE produto SET preco=preco+3 WHERE id=?",produto);
            assertEquals(new BigDecimal("16.00"),pedidos.pedido(draft.id(),mesa).subtotal());
            db.jdbc().update("UPDATE produto SET disponivel=0 WHERE id=?",produto);
            var indisponivel=pedidos.rascunho(outraMesa);
            assertEquals(HttpStatus.UNPROCESSABLE_ENTITY,assertThrows(ApiException.class,() ->
                pedidos.adicionar(outraMesa,indisponivel.id(),new PedidoService.ItemInput(produto,1,null,Set.of()))).status());
            db.jdbc().update("UPDATE produto SET disponivel=1 WHERE id=?",produto);
            String cheddar=db.str(db.one("SELECT id FROM adicional WHERE nome='Cheddar'"),"id");
            var comAdicional=pedidos.adicionar(outraMesa,indisponivel.id(),new PedidoService.ItemInput(produto,2,null,Set.of(cheddar)));
            assertEquals(new BigDecimal("46.00"),comAdicional.subtotal());
            String pudim=db.str(db.one("SELECT id FROM produto WHERE nome='Pudim'"),"id");
            assertEquals(HttpStatus.UNPROCESSABLE_ENTITY,assertThrows(ApiException.class,() ->
                pedidos.adicionar(outraMesa,indisponivel.id(),new PedidoService.ItemInput(pudim,1,null,Set.of(cheddar)))).status());
            String usuario=db.id();
            db.jdbc().update("INSERT INTO usuario(id,nome,username,senha_hash,papel,ativo) VALUES(?,'Teste','teste-autor','hash','GERENTE',1)",usuario);
            var auth=new UsernamePasswordAuthenticationToken(usuario,null,List.of(new SimpleGrantedAuthority("ROLE_GERENTE")));
            var gate=new CountDownLatch(1);
            try(var pool=Executors.newFixedThreadPool(2)) {
                var calls=IntStream.range(0,2).mapToObj(n -> pool.submit(() -> {
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    try { gate.await(); return kanban.transicao(draft.id(),new KanbanService.Transicao("EM_PREPARO",null,sent.versao())); }
                    finally { SecurityContextHolder.clearContext(); }
                })).toList();
                gate.countDown(); int success=0,conflict=0;
                for(var future:calls) try { future.get(); success++; }
                catch(ExecutionException ex) { if(ex.getCause() instanceof ApiException api && api.status()==HttpStatus.CONFLICT) conflict++; else throw ex; }
                assertEquals(1,success); assertEquals(1,conflict);
            }
            var current=pedidos.pedido(draft.id(),mesa);
            SecurityContextHolder.getContext().setAuthentication(auth);
            try {
                current=kanban.transicao(draft.id(),new KanbanService.Transicao("PRONTO",null,current.versao()));
                current=kanban.transicao(draft.id(),new KanbanService.Transicao("ENTREGUE",null,current.versao()));
                var comanda=pedidos.comandaAtual(mesa);
                assertEquals(new BigDecimal("17.60"),comanda.total());
                var fechamento=contas.fechar(comanda.id(),new ContaService.Fechamento(
                    List.of(new ContaService.PagamentoInput("PIX",comanda.total(),null)),false,false));
                assertEquals("PAGA",fechamento.comanda().status());
                assertEquals("LIVRE",pedidos.estado(mesa,1).estado());
            } finally { SecurityContextHolder.clearContext(); }
            var outros=new ArrayList<String>();
            for(int n=0;n<50;n++) {
                String id=db.id();
                db.jdbc().update("INSERT INTO mesa(id,numero,capacidade,ativa) VALUES(?,?,4,1)",id,1000+n);
                var p=pedidos.rascunho(id);
                pedidos.adicionar(id,p.id(),new PedidoService.ItemInput(produto,1,null,Set.of()));
                outros.add(id+":"+p.id());
            }
            try(var pool=Executors.newFixedThreadPool(50)) {
                var futures=outros.stream().map(pair -> pool.submit(() -> {
                    String[] parts=pair.split(":");
                    return pedidos.enviar(parts[0],parts[1],new PedidoService.Envio(null)).numeroDiario();
                })).toList();
                var numbers=new ArrayList<Integer>();
                for(var future:futures) numbers.add(future.get());
                Collections.sort(numbers);
                assertEquals(50,numbers.size());
                assertEquals(IntStream.rangeClosed(numbers.getFirst(),numbers.getFirst()+49).boxed().toList(),numbers);
            }
            String[] primeiraMesa=outros.getFirst().split(":");
            SecurityContextHolder.getContext().setAuthentication(auth);
            try {
                var paraEntregar=pedidos.pedidoAdmin(primeiraMesa[1]);
                for(String status:List.of("EM_PREPARO","PRONTO","ENTREGUE"))
                    paraEntregar=kanban.transicao(primeiraMesa[1],new KanbanService.Transicao(status,null,paraEntregar.versao()));
                var contaDinheiro=pedidos.comandaAtual(primeiraMesa[0]);
                assertEquals(HttpStatus.UNPROCESSABLE_ENTITY,assertThrows(ApiException.class,() ->
                    contas.fechar(contaDinheiro.id(),new ContaService.Fechamento(
                        List.of(new ContaService.PagamentoInput("DINHEIRO",new BigDecimal("1.00"),new BigDecimal("1.00"))),false,false))).status());
                assertEquals("ABERTA",pedidos.comandaAtual(primeiraMesa[0]).status());
                var cash=contas.fechar(contaDinheiro.id(),new ContaService.Fechamento(
                    List.of(new ContaService.PagamentoInput("DINHEIRO",contaDinheiro.total(),contaDinheiro.total().add(new BigDecimal("5.00")))),false,false));
                assertEquals(new BigDecimal("5.00"),cash.troco());
            } finally { SecurityContextHolder.clearContext(); }
            var proximo=pedidos.rascunho(primeiraMesa[0]);
            pedidos.adicionar(primeiraMesa[0],proximo.id(),new PedidoService.ItemInput(produto,1,null,Set.of()));
            var proximoDia=context.getBean(Tempo.class).diaOperacional(Instant.now()).plusDays(1);
            var instanteProximoDia=proximoDia.atTime(5,0).atZone(ZoneId.of("America/Sao_Paulo")).toInstant();
            var servicoNoProximoDia=new PedidoService(db,Clock.fixed(instanteProximoDia,ZoneOffset.UTC),
                context.getBean(Tempo.class),context.getBean(AdicionalPolicy.class),context,
                context.getBean(PlatformTransactionManager.class),context.getBean(PedidoConsulta.class),
                context.getBean(japones.dev.plateon.conta.service.ComandaConsulta.class),
                context.getBean(japones.dev.plateon.conta.service.ComandaRegras.class));
            var reiniciado=servicoNoProximoDia.enviar(primeiraMesa[0],proximo.id(),new PedidoService.Envio(null));
            assertEquals(proximoDia,reiniciado.diaOperacional());
            assertEquals(1,reiniciado.numeroDiario());
            var chamado=pedidos.chamar(mesa,new PedidoService.ChamadoInput("AJUDA"));
            try(var em=context.getBean(EntityManagerFactory.class).createEntityManager()) {
                var jpaPedido=em.find(Pedido.class,UUID.fromString(draft.id()));
                assertEquals(PedidoStatus.ENTREGUE,jpaPedido.getStatus());
                assertEquals(sent.numeroDiario(),jpaPedido.getNumeroDiario());
                assertEquals(sent.diaOperacional(),jpaPedido.getDiaOperacional());
                assertEquals("PAGA",jpaPedido.getComanda().getStatus().name());
                assertEquals(1,jpaPedido.getComanda().getMesa().getNumero());
                assertEquals(new BigDecimal("10.00"),jpaPedido.getComanda().getTaxaServicoPercentual());
                assertEquals(new BigDecimal("16.00"),jpaPedido.getComanda().getSubtotalFechamento());
                assertEquals(new BigDecimal("1.60"),jpaPedido.getComanda().getTaxaFechamento());
                assertEquals(new BigDecimal("17.60"),jpaPedido.getComanda().getTotalFechamento());
                var itens=em.createQuery("select i from ItemPedido i where i.pedido.id=:id",ItemPedido.class)
                    .setParameter("id",UUID.fromString(draft.id())).getResultList();
                assertEquals(1,itens.size());
                assertEquals(new BigDecimal("16.00"),itens.getFirst().getPrecoUnitario());
                assertEquals("X-Burger",itens.getFirst().getNomeProduto());
                assertEquals(1,itens.getFirst().getQuantidade());
                assertEquals(produto,itens.getFirst().getProduto().getId().toString());
                var historico=em.createQuery("select h from PedidoStatusHistorico h where h.pedido.id=:id",PedidoStatusHistorico.class)
                    .setParameter("id",UUID.fromString(draft.id())).getResultList();
                assertEquals(4,historico.size());
                assertTrue(historico.stream().anyMatch(h -> h.getPara()==PedidoStatus.PRONTO && h.getUsuario()!=null));
                var pagamentos=em.createQuery("select p from Pagamento p where p.comanda.id=:id",Pagamento.class)
                    .setParameter("id",jpaPedido.getComanda().getId()).getResultList();
                assertEquals(FormaPagamento.PIX,pagamentos.getFirst().getForma());
                assertEquals(new BigDecimal("17.60"),pagamentos.getFirst().getValor());
                assertEquals(usuario,pagamentos.getFirst().getRegistradoPor().getId().toString());
                var extras=em.createQuery("select a from ItemAdicional a where a.itemPedido.pedido.id=:id",ItemAdicional.class)
                    .setParameter("id",UUID.fromString(indisponivel.id())).getResultList();
                assertEquals("Cheddar",extras.getFirst().getNome());
                assertEquals(new BigDecimal("4.00"),extras.getFirst().getPreco());
                assertEquals(cheddar,extras.getFirst().getAdicional().getId().toString());
                var dispositivo=em.find(Dispositivo.class,UUID.fromString(aprovado.id()));
                assertEquals(64,dispositivo.getTokenHash().length());
                assertEquals(1,dispositivo.getMesa().getNumero());
                assertTrue(dispositivo.getAtivo());
                assertEquals(PareamentoStatus.CONSUMIDA,em.find(SolicitacaoPareamento.class,UUID.fromString(solicitacao.solicitacaoId())).getStatus());
                assertEquals(ChamadoTipo.AJUDA,em.find(ChamadoGarcom.class,UUID.fromString(chamado.id())).getTipo());
                assertEquals("GERENTE",em.find(Usuario.class,UUID.fromString(usuario)).getPapel().name());
                assertEquals(new BigDecimal("19.00"),em.find(Produto.class,UUID.fromString(produto)).getPreco());
                assertTrue(em.find(Adicional.class,UUID.fromString(cheddar)).getCategorias().contains(Categoria.HAMBURGUERES));
            }
        } finally { if(mysql!=null) mysql.stop(); }
    }
}
