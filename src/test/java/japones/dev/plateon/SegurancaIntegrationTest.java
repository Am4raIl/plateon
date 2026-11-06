package japones.dev.plateon;

import java.net.URI;
import java.net.http.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.Duration;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import japones.dev.plateon.compartilhado.Tempo;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.mysql.MySQLContainer;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

class SegurancaIntegrationTest {
    private final HttpClient http=HttpClient.newHttpClient();
    private final ObjectMapper json=new ObjectMapper();
    private String base;
    record Resposta(int status,String body) {}
    Resposta request(String method,String path,String body,String token) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create(base+path)).header("Content-Type","application/json");
        if(token!=null) builder.header("Authorization","Bearer "+token);
        var data=body==null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body);
        var response=http.send(builder.method(method,data).build(),HttpResponse.BodyHandlers.ofString());
        return new Resposta(response.statusCode(),response.body());
    }
    @SuppressWarnings("unchecked") Map<String,Object> object(String text) { return json.readValue(text,Map.class); }
    @SuppressWarnings("unchecked") List<Map<String,Object>> array(String text) { return json.readValue(text,List.class); }
    String login(String username) throws Exception {
        var response=request("POST","/auth/login","{\"username\":\""+username+"\",\"senha\":\"dev12345678\"}",null);
        assertEquals(200,response.status()); return (String)object(response.body()).get("token");
    }
    private HttpResponse<InputStream> stream(String path,String token) throws Exception {
        var response=http.send(HttpRequest.newBuilder(URI.create(base+path)).timeout(Duration.ofSeconds(5))
            .header("Authorization","Bearer "+token).header("Accept","text/event-stream").GET().build(),HttpResponse.BodyHandlers.ofInputStream());
        assertEquals(200,response.statusCode());
        return response;
    }
    private String evento(BufferedReader reader) throws Exception {
        return CompletableFuture.supplyAsync(() -> {
            try {
                var texto=new StringBuilder();
                for(String linha;(linha=reader.readLine())!=null;) {
                    if(linha.isEmpty() && !texto.isEmpty()) break;
                    texto.append(linha);
                }
                return texto.toString();
            } catch(IOException ex) { throw new UncheckedIOException(ex); }
        }).get(5,TimeUnit.SECONDS);
    }
    private void streamEncerrado(BufferedReader reader) throws Exception {
        assertTrue(CompletableFuture.supplyAsync(() -> {
            try { while(reader.readLine()!=null) {} return true; }
            catch(IOException ex) { throw new UncheckedIOException(ex); }
        }).get(5,TimeUnit.SECONDS));
    }
    private void verificarEventosERevogacao(org.springframework.context.ConfigurableApplicationContext context,
            String gerente,String cozinha,List<Map<String,Object>> devices) throws Exception {
        var db=context.getBean(japones.dev.plateon.compartilhado.Sql.class);
        var eventos=context.getBean(japones.dev.plateon.pedido.service.PedidoEventos.class);
        var tablet=devices.stream().filter(d -> d.get("nome").equals("Demo tablet 3")).findFirst().orElseThrow();
        String pedido=db.str(db.one("SELECT p.id FROM pedido p JOIN comanda c ON c.id=p.comanda_id WHERE c.mesa_id=? AND p.status='RECEBIDO' LIMIT 1",tablet.get("mesaId")),"id");
        try(var equipe=stream("/admin/kanban/eventos",cozinha).body();
            var mesa=stream("/mesa/pedidos/"+pedido+"/eventos","dev-tablet-3").body()) {
            var equipeReader=new BufferedReader(new InputStreamReader(equipe,StandardCharsets.UTF_8));
            var mesaReader=new BufferedReader(new InputStreamReader(mesa,StandardCharsets.UTF_8));
            assertTrue(evento(equipeReader).contains("conectado"));
            assertTrue(evento(mesaReader).contains("conectado"));
            var tx=new org.springframework.transaction.support.TransactionTemplate(context.getBean(org.springframework.transaction.PlatformTransactionManager.class));
            tx.executeWithoutResult(status -> {
                context.publishEvent(new japones.dev.plateon.pedido.service.PedidoEventos.Evento(pedido,"IGNORAR_ROLLBACK"));
                status.setRollbackOnly();
            });
            eventos.heartbeat();
            assertTrue(evento(equipeReader).contains("heartbeat"));
            assertTrue(evento(mesaReader).contains("heartbeat"));
            assertEquals(200,request("POST","/mesa/pedidos/"+pedido+"/cancelar",null,"dev-tablet-3").status());
            assertTrue(evento(equipeReader).contains("CANCELADO"));
            assertTrue(evento(mesaReader).contains("CANCELADO"));
            assertEquals(200,request("DELETE","/admin/dispositivos/"+tablet.get("id"),null,gerente).status());
            String usuario=db.str(db.one("SELECT id FROM usuario WHERE username='dev_cozinha_1'"),"id");
            assertEquals(200,request("DELETE","/admin/usuarios/"+usuario,null,gerente).status());
            eventos.heartbeat();
            streamEncerrado(equipeReader);
            streamEncerrado(mesaReader);
            assertEquals(403,request("GET","/admin/kanban/eventos",null,cozinha).status());
            assertEquals(401,request("GET","/mesa/pedidos/"+pedido+"/eventos",null,"dev-tablet-3").status());
        }
    }
    @Test void papelIsolamentoPareamentoERevogacao() throws Exception {
        String external=System.getenv("PLATEON_SECURITY_TEST_JDBC");
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
                    "--spring.profiles.active=dev","--server.port=0")) {
            base="http://127.0.0.1:"+((ServletWebServerApplicationContext)context).getWebServer().getPort()+"/api/v1";
            String gerente=login("dev_gerente_1"),cozinha=login("dev_cozinha_1"),garcom=login("dev_garcom_1"),caixa=login("dev_caixa_1");
            assertEquals(200,request("GET","/admin/kanban",null,cozinha).status());
            assertEquals(403,request("GET","/admin/produtos",null,cozinha).status());
            assertEquals(403,request("GET","/admin/kanban",null,caixa).status());
            assertEquals(200,request("GET","/admin/chamados",null,garcom).status());
            var resumos=object(request("GET","/admin/comandas/resumos",null,garcom).body());
            var resumo=(Map<String,Object>)((List<?>)resumos.get("itens")).getFirst();
            assertFalse(resumo.containsKey("pedidos"));
            var detalhe=object(request("GET","/admin/comandas/"+resumo.get("id"),null,garcom).body());
            assertTrue(detalhe.containsKey("pedidos"));
            assertEquals(new BigDecimal(detalhe.get("total").toString()),new BigDecimal(resumo.get("total").toString()));
            assertEquals(401,request("GET","/admin/mesas",null,"dev-tablet-1").status());
            assertEquals(401,request("GET","/mesa/estado",null,gerente).status());
            var relatorio=request("GET","/admin/dashboard/fechamento-diario",null,gerente);
            assertEquals(200,relatorio.status());
            assertTrue(object(relatorio.body()).containsKey("vendasPorFormaPagamento"));
            var ontem=context.getBean(Tempo.class).diaOperacional(Instant.now()).minusDays(1);
            var fechamento=object(request("GET","/admin/dashboard/fechamento-diario?dia="+ontem,null,gerente).body());
            assertEquals(0,new BigDecimal(fechamento.get("totalVendido").toString()).compareTo(new BigDecimal("16.00")));
            assertEquals(0,new BigDecimal(fechamento.get("taxaServicoArrecadada").toString()).compareTo(new BigDecimal("1.60")));
            assertEquals(1,((Number)fechamento.get("totalPedidos")).intValue());
            assertEquals(2,((List<?>)fechamento.get("vendasPorFormaPagamento")).size());
            var novaMesa=object(request("POST","/admin/mesas","{\"numero\":5000,\"capacidade\":4,\"ativa\":true}",gerente).body());
            String novaMesaId=(String)novaMesa.get("id");
            assertEquals(409,request("POST","/admin/mesas","{\"numero\":5000,\"capacidade\":4,\"ativa\":true}",gerente).status());
            assertEquals(200,request("PATCH","/admin/mesas/"+novaMesaId,"{\"numero\":5000,\"capacidade\":6,\"ativa\":true}",gerente).status());
            assertEquals(6,((Number)object(request("GET","/admin/mesas/"+novaMesaId,null,gerente).body()).get("capacidade")).intValue());
            assertEquals(200,request("DELETE","/admin/mesas/"+novaMesaId,null,gerente).status());
            var usuario=object(request("POST","/admin/usuarios","{\"nome\":\"Teste\",\"username\":\"teste_admin\",\"senha\":\"senha12345\",\"papel\":\"GARCOM\",\"ativo\":true}",gerente).body());
            String usuarioId=(String)usuario.get("id");
            assertEquals(200,request("PATCH","/admin/usuarios/"+usuarioId,"{\"nome\":\"Teste 2\",\"username\":\"teste_admin\",\"papel\":\"CAIXA\",\"ativo\":true}",gerente).status());
            assertEquals("CAIXA",object(request("GET","/admin/usuarios/"+usuarioId,null,gerente).body()).get("papel"));
            assertEquals(200,request("DELETE","/admin/usuarios/"+usuarioId,null,gerente).status());
            assertEquals(422,request("POST","/admin/adicionais","{\"nome\":\"Invalido\",\"preco\":1,\"ativo\":true,\"categorias\":[\"BEBIDAS\"]}",gerente).status());
            var extra=object(request("POST","/admin/adicionais","{\"nome\":\"Teste extra\",\"preco\":2.50,\"ativo\":true,\"categorias\":[\"HAMBURGUERES\"]}",gerente).body());
            String extraId=(String)extra.get("id");
            assertEquals(200,request("PATCH","/admin/adicionais/"+extraId,"{\"nome\":\"Teste extra\",\"preco\":3.50,\"ativo\":true,\"categorias\":[\"HAMBURGUERES\"]}",gerente).status());
            assertEquals(200,request("PUT","/admin/adicionais/"+extraId+"/categorias","[\"PIZZAS\"]",gerente).status());
            assertTrue(request("GET","/admin/adicionais/"+extraId,null,gerente).body().contains("PIZZAS"));
            var produto=object(request("POST","/admin/produtos","{\"nome\":\"Teste produto\",\"categoria\":\"PIZZAS\",\"preco\":20.00,\"estacao\":\"COZINHA\",\"tempoPreparoEstimadoMin\":15,\"disponivel\":true,\"ativo\":true}",gerente).body());
            String produtoId=(String)produto.get("id");
            assertTrue(produto.get("adicionaisDisponiveis").toString().contains("Teste extra"));
            assertEquals(200,request("PATCH","/admin/produtos/"+produtoId,"{\"nome\":\"Teste produto\",\"categoria\":\"PIZZAS\",\"preco\":22.00,\"estacao\":\"COZINHA\",\"tempoPreparoEstimadoMin\":15,\"disponivel\":true,\"ativo\":true}",gerente).status());
            assertEquals(200,request("PATCH","/admin/produtos/"+produtoId+"/disponibilidade","{\"disponivel\":false}",gerente).status());
            assertTrue(request("GET","/mesa/cardapio",null,"dev-tablet-1").body().contains("Teste produto"));
            assertEquals(200,request("DELETE","/admin/produtos/"+produtoId,null,gerente).status());
            assertEquals(200,request("DELETE","/admin/adicionais/"+extraId,null,gerente).status());
            var comanda2=object(request("GET","/mesa/comanda",null,"dev-tablet-2").body());
            var pedido2=(Map<String,Object>)((List<?>)comanda2.get("pedidos")).getFirst();
            assertEquals(404,request("GET","/mesa/pedidos/"+pedido2.get("id")+"/eventos",null,"dev-tablet-1").status());
            assertEquals(400,request("POST","/mesa/chamados","{\"tipo\":\"AJUDA\",\"mesaId\":\"falsa\"}","dev-tablet-1").status());
            var mesas=array(request("GET","/admin/mesas",null,gerente).body());
            String mesa11=(String)mesas.stream().filter(m -> ((Number)m.get("numero")).intValue()==11).findFirst().orElseThrow().get("id");
            var solicitacao=object(request("POST","/dispositivos/pareamento",null,null).body());
            String codigo=(String)solicitacao.get("codigo"), solicitacaoId=(String)solicitacao.get("solicitacaoId");
            assertEquals(200,request("POST","/admin/dispositivos/pareamento/aprovar",
                "{\"codigo\":\""+codigo+"\",\"mesaId\":\""+mesa11+"\"}",garcom).status());
            var entregue=object(request("GET","/dispositivos/pareamento/"+solicitacaoId,null,null).body());
            assertNotNull(entregue.get("token"));
            assertEquals(410,request("GET","/dispositivos/pareamento/"+solicitacaoId,null,null).status());
            var devices=array(request("GET","/admin/dispositivos",null,gerente).body());
            verificarEventosERevogacao(context,gerente,cozinha,devices);
            var d1=devices.stream().filter(d -> d.get("nome").equals("Demo tablet 1")).findFirst().orElseThrow();
            var d2=devices.stream().filter(d -> d.get("nome").equals("Demo tablet 2")).findFirst().orElseThrow();
            assertEquals(409,request("PATCH","/admin/dispositivos/"+d1.get("id"),"{\"mesaId\":\""+d2.get("mesaId")+"\"}",gerente).status());
            assertEquals(200,request("DELETE","/admin/dispositivos/"+d2.get("id"),null,gerente).status());
            assertEquals(200,request("PATCH","/admin/dispositivos/"+d1.get("id"),"{\"mesaId\":\""+d2.get("mesaId")+"\"}",gerente).status());
            var estado=object(request("GET","/mesa/estado",null,"dev-tablet-1").body());
            assertEquals(2,((Number)estado.get("numeroMesa")).intValue());
            assertEquals(200,request("DELETE","/admin/dispositivos/"+d1.get("id"),null,gerente).status());
            assertEquals(401,request("GET","/mesa/estado",null,"dev-tablet-1").status());
        } finally { if(mysql!=null) mysql.stop(); }
    }
}
