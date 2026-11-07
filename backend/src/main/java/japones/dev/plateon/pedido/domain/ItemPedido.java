package japones.dev.plateon.pedido.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import japones.dev.plateon.cardapio.domain.Produto;
import japones.dev.plateon.cardapio.domain.Estacao;
import japones.dev.plateon.cardapio.domain.Categoria;

@Entity
@Table(name="item_pedido")
public class ItemPedido {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="pedido_id")
    private Pedido pedido;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="produto_id")
    private Produto produto;
    @Column(name="quantidade",nullable=false)
    private int quantidade;
    @Column(name="observacao",length=200)
    private String observacao;
    @Column(name="nome_produto",length=120,nullable=false)
    private String nomeProduto;
    @Column(name="preco_unitario",precision=10,scale=2,nullable=false)
    private BigDecimal precoUnitario;
    @Enumerated(EnumType.STRING)
    @Column(name="estacao",length=20,nullable=false)
    private Estacao estacao;
    @Enumerated(EnumType.STRING)
    @Column(name="categoria",length=30,nullable=false)
    private Categoria categoria;

    protected ItemPedido() {}
    public ItemPedido(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public Pedido getPedido() { return pedido; }
    public void setPedido(Pedido pedido) { this.pedido=pedido; }
    public Produto getProduto() { return produto; }
    public void setProduto(Produto produto) { this.produto=produto; }
    public int getQuantidade() { return quantidade; }
    public void setQuantidade(int quantidade) { this.quantidade=quantidade; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao=observacao; }
    public String getNomeProduto() { return nomeProduto; }
    public void setNomeProduto(String nomeProduto) { this.nomeProduto=nomeProduto; }
    public BigDecimal getPrecoUnitario() { return precoUnitario; }
    public void setPrecoUnitario(BigDecimal precoUnitario) { this.precoUnitario=precoUnitario; }
    public Estacao getEstacao() { return estacao; }
    public void setEstacao(Estacao estacao) { this.estacao=estacao; }
    public Categoria getCategoria() { return categoria; }
    public void setCategoria(Categoria categoria) { this.categoria=categoria; }
}
