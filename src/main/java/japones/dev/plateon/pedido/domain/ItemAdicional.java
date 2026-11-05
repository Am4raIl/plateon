package japones.dev.plateon.pedido.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import japones.dev.plateon.cardapio.domain.Adicional;

@Entity
@Table(name="item_adicional")
public class ItemAdicional {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="item_pedido_id")
    private ItemPedido itemPedido;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="adicional_id")
    private Adicional adicional;
    @Column(name="nome",length=120,nullable=false)
    private String nome;
    @Column(name="preco",precision=10,scale=2,nullable=false)
    private BigDecimal preco;

    protected ItemAdicional() {}
    public ItemAdicional(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public ItemPedido getItemPedido() { return itemPedido; }
    public void setItemPedido(ItemPedido itemPedido) { this.itemPedido=itemPedido; }
    public Adicional getAdicional() { return adicional; }
    public void setAdicional(Adicional adicional) { this.adicional=adicional; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome=nome; }
    public BigDecimal getPreco() { return preco; }
    public void setPreco(BigDecimal preco) { this.preco=preco; }
}
