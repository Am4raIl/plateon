package japones.dev.plateon.seed;

import japones.dev.plateon.compartilhado.*;
import japones.dev.plateon.pedido.service.PedidoService;
import japones.dev.plateon.seguranca.SecurityConfig;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("dev")
@Order(2)
public class DemoSeeder implements ApplicationRunner {
    private final Sql db; private final Clock clock; private final Tempo tempo; private final PasswordEncoder passwords; private final PedidoService pedidos;
    public DemoSeeder(Sql db,Clock clock,Tempo tempo,PasswordEncoder passwords,PedidoService pedidos) {
        this.db=db;this.clock=clock;this.tempo=tempo;this.passwords=passwords;this.pedidos=pedidos;
    }
    @Override @Transactional public void run(ApplicationArguments args) {
        for(String papel:List.of("COZINHA","GARCOM","CAIXA","GERENTE")) for(int n=1;n<=2;n++) {
            String username="dev_"+papel.toLowerCase()+"_"+n;
            if(db.optional("SELECT id FROM usuario WHERE username=?",username)==null)
                db.jdbc().update("INSERT INTO usuario(id,nome,username,senha_hash,papel,ativo) VALUES(?,?,?,?,?,1)",
                    db.id(),"Demo "+papel+" "+n,username,passwords.encode("dev12345678"),papel);
        }
        for(int n=1;n<=10;n++) {
            var mesa=db.one("SELECT id FROM mesa WHERE numero=?",n);
            String nome="Demo tablet "+n;
            if(db.optional("SELECT id FROM dispositivo WHERE nome=?",nome)==null
                    && db.optional("SELECT id FROM dispositivo WHERE mesa_id=? AND ativo=1",mesa.get("id"))==null)
                db.jdbc().update("INSERT INTO dispositivo(id,mesa_id,nome,token_hash,ativo,pareado_em,ultimo_acesso_em,revogado_em) VALUES(?,?,?,?,?,?,?,?)",
                    db.id(),mesa.get("id"),nome,SecurityConfig.hash("dev-tablet-"+n),n<10,db.ts(clock.instant().minusSeconds(86400)),
                    db.ts(clock.instant().minusSeconds(n<=7 ? 30 : 600)),n==10 ? db.ts(clock.instant()) : null);
        }
        for(int n=0;n<6;n++) {
            String codigo="DEMA"+(n+2)+"X";
            if(db.optional("SELECT id FROM solicitacao_pareamento WHERE codigo=?",codigo)==null)
                db.jdbc().update("INSERT INTO solicitacao_pareamento(id,codigo,status,criada_em,expira_em) VALUES(?,?,?,?,?)",
                    db.id(),codigo,n==0 ? "PENDENTE" : "EXPIRADA",db.ts(clock.instant().minusSeconds(n*1000)),
                    db.ts(clock.instant().plusSeconds(n==0 ? 600 : -100)));
        }
        String caixa=db.str(db.one("SELECT id FROM usuario WHERE username='dev_caixa_1'"),"id");
        var produtos=db.jdbc().queryForList("SELECT * FROM produto WHERE ativo=1 ORDER BY nome");
        var produto=db.one("SELECT * FROM produto WHERE nome='X-Burger'");
        for(int dias=1;dias<=45;dias++) {
            var produtoHistorico=produtos.get((dias-1)%produtos.size());
            int quantidade=1+dias%3;
            String marcador="Demo historico "+dias;
            if(db.optional("SELECT id FROM pedido WHERE observacao_geral=?",marcador)!=null) continue;
            Instant quando=clock.instant().minus(Duration.ofDays(dias));
            var mesa=db.one("SELECT id FROM mesa WHERE numero=?",dias);
            if(dias<=5 && db.optional("SELECT id FROM comanda WHERE mesa_id=? AND status='PAGA' AND fechada_em>=? AND fechada_em<?",
                mesa.get("id"),db.ts(quando.minusSeconds(3600)),db.ts(quando.plusSeconds(3600)))!=null) continue;
            String comanda=db.id(),pedido=db.id(),item=db.id();
            db.jdbc().update("INSERT INTO comanda(id,mesa_id,status,aberta_em,fechada_em,taxa_servico_percentual,couvert) VALUES(?,?,'PAGA',?,?,10,0)",
                comanda,mesa.get("id"),db.ts(quando.minusSeconds(3600)),db.ts(quando));
            LocalDate dia=tempo.diaOperacional(quando.minusSeconds(1800));
            db.jdbc().update("INSERT IGNORE INTO contador_diario(dia_operacional,ultimo_numero) VALUES(?,0)",dia);
            db.jdbc().update("UPDATE contador_diario SET ultimo_numero=ultimo_numero+1 WHERE dia_operacional=?",dia);
            int numero=((Number)db.one("SELECT ultimo_numero FROM contador_diario WHERE dia_operacional=?",dia).get("ultimo_numero")).intValue();
            db.jdbc().update("INSERT INTO pedido(id,comanda_id,status,numero_diario,dia_operacional,observacao_geral,criado_em,atualizado_em,enviado_em) VALUES(?,?,'ENTREGUE',?,?,?,?,?,?)",
                pedido,comanda,numero,dia,marcador,db.ts(quando.minusSeconds(2000)),db.ts(quando),db.ts(quando.minusSeconds(1800)));
            db.jdbc().update("INSERT INTO item_pedido(id,pedido_id,produto_id,quantidade,nome_produto,preco_unitario,estacao) VALUES(?,?,?,?,?,?,?)",
                item,pedido,produtoHistorico.get("id"),quantidade,produtoHistorico.get("nome"),produtoHistorico.get("preco"),produtoHistorico.get("estacao"));
            historico(pedido,"RASCUNHO","RECEBIDO",quando.minusSeconds(1800));
            historico(pedido,"RECEBIDO","EM_PREPARO",quando.minusSeconds(1500));
            historico(pedido,"EM_PREPARO","PRONTO",quando.minusSeconds(900));
            historico(pedido,"PRONTO","ENTREGUE",quando.minusSeconds(600));
            BigDecimal total=Validar.dinheiro(produtoHistorico.get("preco")).multiply(BigDecimal.valueOf(quantidade)).multiply(new BigDecimal("1.10"));
            if(dias==1) {
                db.jdbc().update("INSERT INTO pagamento(id,comanda_id,forma,valor,registrado_em,registrado_por) VALUES(?,?,?,?,?,?)",db.id(),comanda,"PIX",total.divide(new BigDecimal("2")),db.ts(quando),caixa);
                db.jdbc().update("INSERT INTO pagamento(id,comanda_id,forma,valor,registrado_em,registrado_por) VALUES(?,?,?,?,?,?)",db.id(),comanda,"DINHEIRO",total.divide(new BigDecimal("2")),db.ts(quando),caixa);
            } else db.jdbc().update("INSERT INTO pagamento(id,comanda_id,forma,valor,registrado_em,registrado_por) VALUES(?,?,?,?,?,?)",
                db.id(),comanda,dias%2==0 ? "CARTAO_CREDITO" : "PIX",total,db.ts(quando),caixa);
        }
        var mesaCancelada=db.one("SELECT id FROM mesa WHERE numero=11");
        if(db.optional("SELECT id FROM comanda WHERE mesa_id=? AND status='CANCELADA'",mesaCancelada.get("id"))==null)
            db.jdbc().update("INSERT INTO comanda(id,mesa_id,status,aberta_em,fechada_em,taxa_servico_percentual,couvert) VALUES(?,?,'CANCELADA',?,?,10,0)",
                db.id(),mesaCancelada.get("id"),db.ts(clock.instant().minusSeconds(86400)),db.ts(clock.instant().minusSeconds(86000)));
        for(int n=0;n<9;n++) {
            int mesaNumero=n%5+1;
            String mesaId=db.str(db.one("SELECT id FROM mesa WHERE numero=?",mesaNumero),"id");
            String marker="Demo pedido "+n;
            if(db.optional("SELECT id FROM pedido WHERE observacao_geral=?",marker)!=null) continue;
            var draft=pedidos.rascunho(mesaId);
            pedidos.adicionar(mesaId,draft.id(),new PedidoService.ItemInput(db.str(produto,"id"),1,null,Set.of()));
            var sent=pedidos.enviar(mesaId,draft.id(),new PedidoService.Envio(marker));
            Instant enviado=clock.instant().minusSeconds((n%3==0 ? 3 : n%3==1 ? 8 : 15)*60L);
            db.jdbc().update("UPDATE pedido SET enviado_em=? WHERE id=?",db.ts(enviado),sent.id());
            db.jdbc().update("UPDATE pedido_status_historico SET em=? WHERE pedido_id=? AND para='RECEBIDO'",db.ts(enviado),sent.id());
            if(n>=3) { db.jdbc().update("UPDATE pedido SET status='EM_PREPARO' WHERE id=?",sent.id()); historico(sent.id(),"RECEBIDO","EM_PREPARO",enviado.plusSeconds(60)); }
            if(n>=6) { db.jdbc().update("UPDATE pedido SET status='PRONTO' WHERE id=?",sent.id()); historico(sent.id(),"EM_PREPARO","PRONTO",enviado.plusSeconds(180)); }
        }
        for(int n=1;n<=12;n++) {
            String mesa=db.str(db.one("SELECT id FROM mesa WHERE numero=?",n),"id");
            if(db.optional("SELECT id FROM chamado_garcom WHERE mesa_id=? AND tipo='AJUDA'",mesa)==null)
                db.jdbc().update("INSERT INTO chamado_garcom(id,mesa_id,tipo,status,criado_em,atendido_em,atendido_por) VALUES(?,?, 'AJUDA',?,?,?,?)",
                    db.id(),mesa,n<=2 ? "ABERTO" : "ATENDIDO",db.ts(clock.instant().minusSeconds(n*60L)),
                    n<=2 ? null : db.ts(clock.instant()),n<=2 ? null : caixa);
        }
    }
    private void historico(String pedido,String de,String para,Instant em) {
        db.jdbc().update("INSERT INTO pedido_status_historico(pedido_id,de,para,em) VALUES(?,?,?,?)",pedido,de,para,db.ts(em));
    }
}
