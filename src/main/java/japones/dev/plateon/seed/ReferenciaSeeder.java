package japones.dev.plateon.seed;

import japones.dev.plateon.cardapio.domain.*;
import japones.dev.plateon.cardapio.service.*;
import japones.dev.plateon.compartilhado.Sql;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class ReferenciaSeeder implements ApplicationRunner {
    private final Sql db; private final CardapioService cardapio; private final PasswordEncoder passwords; private final ImagemProdutoStore imagens;
    @Value("${restaurante.seed.referencia:true}") private boolean enabled;
    @Value("${ADMIN_USERNAME:}") private String adminUsername;
    @Value("${ADMIN_PASSWORD:}") private String adminPassword;
    public ReferenciaSeeder(Sql db,CardapioService cardapio,PasswordEncoder passwords,ImagemProdutoStore imagens) { this.db=db;this.cardapio=cardapio;this.passwords=passwords;this.imagens=imagens; }
    private static final String PRODUTOS="""
        ENTRADAS|Bruschetta de Tomate:22;Bolinho de Queijo (6 un):24;Caldinho de Feijão:14;Salada Caprese:26;Pastelzinho de Carne (8 un):25
        PORCOES|Batata Frita:32;Batata com Cheddar e Bacon:42;Mandioca Frita:30;Isca de Frango:45;Calabresa Acebolada:38;Onion Rings:28
        HAMBURGUERES|X-Burger:16;X-Salada:18;X-Bacon:22;X-Egg:20;X-Tudo:28;Burger Vegetariano:24
        MASSAS|Espaguete à Bolonhesa:38;Fettuccine Alfredo:42;Penne ao Sugo:34;Lasanha à Bolonhesa:44;Nhoque ao Molho Branco:40
        PIZZAS|Margherita:48;Calabresa:50;Portuguesa:54;Quatro Queijos:56;Frango com Catupiry:52
        PRATOS_PRINCIPAIS|Filé à Parmegiana:58;Picanha na Chapa:89;Frango Grelhado:42;Salmão Grelhado:78;Feijoada Individual:46
        BEBIDAS|Coca-Cola Lata:7;Guaraná Lata:7;Água Mineral:5;Suco de Laranja:12;Cerveja Long Neck:12;Caipirinha:22
        SOBREMESAS|Pudim:14;Petit Gâteau:28;Brownie com Sorvete:26;Mousse de Maracujá:12;Torta de Limão:16
        """;
    private static final String ADICIONAIS="""
        Cheddar|4.00|HAMBURGUERES,PORCOES
        Bacon extra|6.00|HAMBURGUERES,PORCOES,MASSAS,PIZZAS
        Ovo|3.00|HAMBURGUERES
        Hambúrguer extra|8.00|HAMBURGUERES
        Queijo extra|5.00|HAMBURGUERES,PIZZAS
        Cebola caramelizada|3.00|HAMBURGUERES
        Molho da casa extra|3.50|ENTRADAS,PORCOES,HAMBURGUERES
        Maionese temperada|3.00|PORCOES
        Vinagrete extra|3.00|ENTRADAS,PORCOES
        Torradas extras|4.00|ENTRADAS
        Parmesão ralado|3.00|ENTRADAS,MASSAS
        Frango desfiado|7.00|MASSAS
        Cogumelos|6.00|MASSAS,PIZZAS
        Borda de catupiry|10.00|PIZZAS
        Borda de cheddar|10.00|PIZZAS
        Azeitonas extras|3.00|PIZZAS,ENTRADAS
        Bola de sorvete|6.00|SOBREMESAS
        Calda de chocolate|3.00|SOBREMESAS
        Calda de caramelo|3.00|SOBREMESAS
        Chantilly|3.00|SOBREMESAS
        """;
    @Override public void run(ApplicationArguments args) {
        if(!enabled) return;
        for(int n=1;n<=12;n++) if(db.optional("SELECT id FROM mesa WHERE numero=?",n)==null)
            db.jdbc().update("INSERT INTO mesa(id,numero,capacidade,ativa) VALUES(?,?,4,1)",db.id(),n);
        for(String line:ADICIONAIS.split("\\R")) {
            if(line.isBlank()) continue;
            String[] fields=line.strip().split("\\|");
            if(db.optional("SELECT id FROM adicional WHERE nome=?",fields[0])!=null) continue;
            var cats=Arrays.stream(fields[2].split(",")).map(Categoria::valueOf).collect(java.util.stream.Collectors.toSet());
            cardapio.criarAdicional(new CardapioService.AdicionalInput(fields[0],new BigDecimal(fields[1]),true,cats));
        }
        for(String line:PRODUTOS.split("\\R")) {
            if(line.isBlank()) continue;
            String[] group=line.strip().split("\\|"); Categoria cat=Categoria.valueOf(group[0]);
            for(String entry:group[1].split(";")) {
                String[] fields=entry.split(":");
                var existente=db.optional("SELECT id,imagem_url,ativo FROM produto WHERE nome=?",fields[0]);
                if(existente!=null) {
                    String ativo=String.valueOf(existente.get("ativo"));
                    String url=db.str(existente,"imagem_url");
                    if(!ativo.equals("0") && !ativo.equalsIgnoreCase("false") &&
                            (url==null || url.equals("/api/v1/imagens/produtos/"+db.str(existente,"id")+".svg")))
                        db.jdbc().update("UPDATE produto SET imagem_url=? WHERE id=?",
                            imagens.criar(UUID.fromString(db.str(existente,"id")),cat),existente.get("id"));
                    continue;
                }
                int tempo=switch(cat) { case BEBIDAS -> 3; case PIZZAS,PRATOS_PRINCIPAIS -> 25;
                    case HAMBURGUERES,MASSAS -> 20; default -> 15; };
                var criado=cardapio.criarProduto(new CardapioService.ProdutoInput(fields[0],null,cat,new BigDecimal(fields[1]),null,
                    cat==Categoria.BEBIDAS ? "BAR" : "COZINHA",tempo,true,true));
                db.jdbc().update("UPDATE produto SET imagem_url=? WHERE id=?",
                    imagens.criar(UUID.fromString(criado.id()),cat),criado.id());
            }
        }
        if(!adminUsername.isBlank() && !adminPassword.isBlank() && db.optional("SELECT id FROM usuario WHERE username=?",adminUsername)==null) {
            if(adminPassword.length()<8) throw new IllegalStateException("ADMIN_PASSWORD deve ter pelo menos 8 caracteres");
            db.jdbc().update("INSERT INTO usuario(id,nome,username,senha_hash,papel,ativo) VALUES(?,?,?,?, 'GERENTE',1)",
                db.id(),"Gerente",adminUsername,passwords.encode(adminPassword));
        }
    }
}
