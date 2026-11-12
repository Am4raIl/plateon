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
    private static final Map<String,String> DESCRICOES=Map.ofEntries(
        Map.entry("Bruschetta de Tomate","Pão, tomate, manjericão, alho e azeite."),
        Map.entry("Bolinho de Queijo (6 un)","Massa de trigo e queijo."),
        Map.entry("Caldinho de Feijão","Feijão, bacon, alho, cebola e cheiro-verde."),
        Map.entry("Salada Caprese","Tomate, muçarela de búfala, manjericão e azeite."),
        Map.entry("Pastelzinho de Carne (8 un)","Massa de pastel, carne moída, cebola e azeitonas."),
        Map.entry("Batata Frita","Batatas fritas e sal."),
        Map.entry("Batata com Cheddar e Bacon","Batatas fritas, cheddar e bacon."),
        Map.entry("Mandioca Frita","Mandioca frita e sal."),
        Map.entry("Isca de Frango","Tiras de frango, farinha de trigo, alho e temperos."),
        Map.entry("Calabresa Acebolada","Linguiça calabresa e cebola."),
        Map.entry("Onion Rings","Anéis de cebola empanados em farinha de trigo."),
        Map.entry("X-Burger","Pão, bife de hambúrguer, queijo, alface e tomate."),
        Map.entry("X-Salada","Pão, bife de hambúrguer, queijo, alface, tomate e maionese."),
        Map.entry("X-Bacon","Pão, bife de hambúrguer, queijo e bacon."),
        Map.entry("X-Egg","Pão, bife de hambúrguer, queijo e ovo."),
        Map.entry("X-Tudo","Pão, bife de hambúrguer, queijo, presunto, bacon, ovo, alface e tomate."),
        Map.entry("Burger Vegetariano","Pão, hambúrguer de grão-de-bico, queijo, alface e tomate."),
        Map.entry("Espaguete à Bolonhesa","Espaguete, carne moída, molho de tomate e parmesão."),
        Map.entry("Fettuccine Alfredo","Fettuccine, manteiga, creme de leite e parmesão."),
        Map.entry("Penne ao Sugo","Penne, molho de tomate, alho e manjericão."),
        Map.entry("Lasanha à Bolonhesa","Massa de lasanha, carne moída, molho de tomate, presunto e muçarela."),
        Map.entry("Nhoque ao Molho Branco","Nhoque de batata, leite, manteiga, farinha de trigo e parmesão."),
        Map.entry("Margherita","Massa de pizza, molho de tomate, muçarela, tomate e manjericão."),
        Map.entry("Calabresa","Massa de pizza, molho de tomate, muçarela, calabresa, cebola e azeitonas."),
        Map.entry("Portuguesa","Massa de pizza, molho de tomate, muçarela, presunto, ovo, cebola e azeitonas."),
        Map.entry("Quatro Queijos","Massa de pizza, molho de tomate, muçarela, provolone, parmesão e gorgonzola."),
        Map.entry("Frango com Catupiry","Massa de pizza, molho de tomate, muçarela, frango desfiado e catupiry."),
        Map.entry("Filé à Parmegiana","Filé bovino empanado, molho de tomate, muçarela, arroz e batatas fritas."),
        Map.entry("Picanha na Chapa","Picanha, alho, arroz, farofa e vinagrete."),
        Map.entry("Frango Grelhado","Filé de frango, alho, arroz e legumes."),
        Map.entry("Salmão Grelhado","Salmão, limão, azeite, arroz e legumes."),
        Map.entry("Feijoada Individual","Feijão preto, carne suína, linguiça, arroz, couve, farofa e laranja."),
        Map.entry("Coca-Cola Lata","Refrigerante de cola gaseificado."),
        Map.entry("Guaraná Lata","Refrigerante de guaraná gaseificado."),
        Map.entry("Água Mineral","Água mineral natural."),
        Map.entry("Suco de Laranja","Laranja espremida."),
        Map.entry("Cerveja Long Neck","Água, malte de cevada, lúpulo e levedura."),
        Map.entry("Caipirinha","Cachaça, limão, açúcar e gelo."),
        Map.entry("Pudim","Leite condensado, leite, ovos e calda de caramelo."),
        Map.entry("Petit Gâteau","Chocolate, manteiga, ovos, açúcar, farinha de trigo e sorvete de creme."),
        Map.entry("Brownie com Sorvete","Chocolate, manteiga, ovos, açúcar, farinha de trigo e sorvete de creme."),
        Map.entry("Mousse de Maracujá","Maracujá, leite condensado e creme de leite."),
        Map.entry("Torta de Limão","Biscoito, manteiga, leite condensado, creme de leite e limão.")
    );
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
                    db.jdbc().update("UPDATE produto SET descricao=? WHERE id=? AND (descricao IS NULL OR TRIM(descricao)='')",
                        DESCRICOES.get(fields[0]),existente.get("id"));
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
                var criado=cardapio.criarProduto(new CardapioService.ProdutoInput(fields[0],DESCRICOES.get(fields[0]),cat,new BigDecimal(fields[1]),null,
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
