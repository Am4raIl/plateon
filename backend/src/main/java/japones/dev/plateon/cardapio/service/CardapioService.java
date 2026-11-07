package japones.dev.plateon.cardapio.service;

import japones.dev.plateon.cardapio.domain.*;
import japones.dev.plateon.cardapio.repository.*;
import japones.dev.plateon.compartilhado.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

@Service
public class CardapioService {
    private final ProdutoRepository produtos; private final AdicionalRepository adicionais; private final ImagemProdutoStore imagens;
    public CardapioService(ProdutoRepository produtos,AdicionalRepository adicionais,ImagemProdutoStore imagens) { this.produtos=produtos;this.adicionais=adicionais;this.imagens=imagens; }
    public record ProdutoInput(@NotBlank @Size(max=120) String nome,String descricao,@NotNull Categoria categoria,
        @NotNull @DecimalMin("0.00") @Digits(integer=8,fraction=2) BigDecimal preco,
        @Pattern(regexp="https?://.+") @Size(max=1000) String imagemUrl,@NotBlank String estacao,
        @Min(1) int tempoPreparoEstimadoMin,boolean disponivel,boolean ativo) {}
    public record AdicionalInput(@NotBlank @Size(max=120) String nome,
        @NotNull @DecimalMin("0.00") @Digits(integer=8,fraction=2) BigDecimal preco,
        boolean ativo,@NotNull Set<Categoria> categorias) {}
    public record AdicionalView(String id,String nome,BigDecimal preco,boolean ativo,Set<Categoria> categorias) {}
    public record ProdutoView(String id,String nome,String descricao,Categoria categoria,BigDecimal preco,
        String imagemUrl,String estacao,int tempoPreparoEstimadoMin,boolean disponivel,boolean ativo,
        List<AdicionalView> adicionaisDisponiveis) {}
    @Transactional(readOnly=true) public List<ProdutoView> cardapio() { return cardapio(null,null); }
    @Transactional(readOnly=true) public List<ProdutoView> cardapio(Categoria categoria,String busca) {
        String termo=termo(busca);
        return listarProdutos(true).stream().filter(p -> categoria==null || p.categoria()==categoria)
            .filter(p -> termo==null || p.nome().toLowerCase(Locale.ROOT).contains(termo)).toList();
    }
    @Transactional(readOnly=true) public Pagina<ProdutoView> produtosPaginados(int pagina,int tamanho,Categoria categoria,Boolean ativo,String busca) {
        Pagina.validar(pagina,tamanho);
        String termo=termo(busca);
        Specification<Produto> filtro=(root,query,cb) -> {
            var condicoes=new ArrayList<jakarta.persistence.criteria.Predicate>();
            if(categoria!=null) condicoes.add(cb.equal(root.get("categoria"),categoria));
            if(ativo!=null) condicoes.add(cb.equal(root.get("ativo"),ativo));
            if(termo!=null) {
                String literal=termo.replace("\\","\\\\").replace("%","\\%").replace("_","\\_");
                condicoes.add(cb.like(cb.lower(root.get("nome")),"%"+literal+"%",'\\'));
            }
            return cb.and(condicoes.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var paginaDb=produtos.findAll(filtro,PageRequest.of(pagina,tamanho,
            Sort.by("categoria").ascending().and(Sort.by("nome").ascending()).and(Sort.by("id").ascending())));
        var extras=adicionais();
        return Pagina.criar(paginaDb.getContent().stream().map(p -> view(p,extras)).toList(),pagina,tamanho,paginaDb.getTotalElements());
    }
    private String termo(String busca) {
        if(busca==null || busca.isBlank()) return null;
        String termo=busca.strip().toLowerCase(Locale.ROOT);
        Validar.exigir(termo.length()<=120,HttpStatus.BAD_REQUEST,"busca deve ter no máximo 120 caracteres");
        return termo;
    }
    @Transactional(readOnly=true) public List<ProdutoView> produtos(boolean soAtivos) { return listarProdutos(soAtivos); }
    private List<ProdutoView> listarProdutos(boolean soAtivos) {
        var extras=adicionais();
        return produtos.findAll().stream().filter(p -> !soAtivos || p.getAtivo())
            .sorted(Comparator.comparing((Produto p) -> p.getCategoria().name()).thenComparing(Produto::getNome))
            .map(p -> view(p,extras)).toList();
    }
    @Transactional(readOnly=true) public ProdutoView produto(String id) { return view(obterProduto(id),adicionais()); }
    @Transactional(readOnly=true) public List<AdicionalView> adicionais() {
        return adicionais.findAll().stream().sorted(Comparator.comparing(Adicional::getNome)).map(this::view).toList();
    }
    @Transactional(readOnly=true) public AdicionalView adicional(String id) { return view(obterAdicional(id)); }
    private ProdutoView view(Produto p,List<AdicionalView> extras) {
        var disponiveis=extras.stream().filter(a -> a.ativo() && p.getCategoria().aceitaAdicionais()
            && a.categorias().contains(p.getCategoria())).toList();
        return new ProdutoView(p.getId().toString(),p.getNome(),p.getDescricao(),p.getCategoria(),p.getPreco(),
            p.getImagemUrl(),p.getEstacao().name(),p.getTempoPreparoEstimadoMin(),p.getDisponivel(),p.getAtivo(),disponiveis);
    }
    private AdicionalView view(Adicional a) {
        return new AdicionalView(a.getId().toString(),a.getNome(),a.getPreco(),a.getAtivo(),Set.copyOf(a.getCategorias()));
    }
    @Transactional public ProdutoView criarProduto(ProdutoInput input) {
        validarProduto(input);
        var p=new Produto(null); preencher(p,input); produtos.saveAndFlush(p); return view(p,adicionais());
    }
    @Transactional public ProdutoView atualizarProduto(String id,ProdutoInput input) {
        validarProduto(input); var p=obterProduto(id); String imagemAnterior=p.getImagemUrl(); preencher(p,input);
        if (!p.getAtivo()) p.setImagemUrl(null);
        produtos.saveAndFlush(p);
        if (!Objects.equals(imagemAnterior,p.getImagemUrl())) imagens.apagarAposCommit(imagemAnterior);
        return view(p,adicionais());
    }
    @Transactional public void disponibilidade(String id,boolean disponivel) {
        var p=obterProduto(id);p.setDisponivel(disponivel);produtos.saveAndFlush(p);
    }
    @Transactional public void desativarProduto(String id) {
        var p=obterProduto(id);String imagemAnterior=p.getImagemUrl();p.setDisponivel(false);p.setAtivo(false);
        p.setImagemUrl(null);produtos.saveAndFlush(p);imagens.apagarAposCommit(imagemAnterior);
    }
    private void preencher(Produto p,ProdutoInput input) {
        p.setNome(input.nome());p.setDescricao(input.descricao());p.setCategoria(input.categoria());p.setPreco(input.preco());
        p.setImagemUrl(input.imagemUrl());p.setEstacao(Estacao.valueOf(input.estacao()));
        p.setTempoPreparoEstimadoMin(input.tempoPreparoEstimadoMin());p.setDisponivel(input.disponivel());p.setAtivo(input.ativo());
    }
    private void validarProduto(ProdutoInput input) {
        Validar.exigir(input.estacao()!=null && Set.of("COZINHA","BAR").contains(input.estacao()),HttpStatus.UNPROCESSABLE_ENTITY,"Estação inválida");
    }
    @Transactional public AdicionalView criarAdicional(AdicionalInput input) {
        validarCategorias(input.categorias()); var a=new Adicional(null);
        preencher(a,input);adicionais.saveAndFlush(a);return view(a);
    }
    @Transactional public AdicionalView atualizarAdicional(String id,AdicionalInput input) {
        validarCategorias(input.categorias());var a=obterAdicional(id);preencher(a,input);adicionais.saveAndFlush(a);return view(a);
    }
    @Transactional public void categorias(String id,Set<Categoria> categorias) {
        validarCategorias(categorias);var a=obterAdicional(id);a.getCategorias().clear();a.getCategorias().addAll(categorias);adicionais.saveAndFlush(a);
    }
    @Transactional public void desativarAdicional(String id) { var a=obterAdicional(id);a.setAtivo(false);adicionais.saveAndFlush(a); }
    private void preencher(Adicional a,AdicionalInput input) {
        a.setNome(input.nome());a.setPreco(input.preco());a.setAtivo(input.ativo());
        a.getCategorias().clear();a.getCategorias().addAll(input.categorias());
    }
    private void validarCategorias(Set<Categoria> categorias) {
        Validar.exigir(categorias!=null && categorias.stream().allMatch(Categoria::aceitaAdicionais),
            HttpStatus.UNPROCESSABLE_ENTITY,"Categoria não aceita adicionais");
    }
    private Produto obterProduto(String id) {
        try { return produtos.findById(UUID.fromString(id)).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"Produto não encontrado")); }
        catch(IllegalArgumentException ex) { throw new ApiException(HttpStatus.NOT_FOUND,"Produto não encontrado"); }
    }
    private Adicional obterAdicional(String id) {
        try { return adicionais.findById(UUID.fromString(id)).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"Adicional não encontrado")); }
        catch(IllegalArgumentException ex) { throw new ApiException(HttpStatus.NOT_FOUND,"Adicional não encontrado"); }
    }
}
