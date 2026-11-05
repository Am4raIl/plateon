package japones.dev.plateon.cardapio.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import japones.dev.plateon.cardapio.domain.Categoria;
import java.util.*;

@Entity
@Table(name="adicional")
public class Adicional {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @Column(name="nome",length=120,nullable=false)
    private String nome;
    @Column(name="preco",precision=10,scale=2,nullable=false)
    private BigDecimal preco;
    @Column(name="ativo",nullable=false)
    private boolean ativo;
    @ElementCollection(fetch=FetchType.EAGER)
    @CollectionTable(name="adicional_categoria",joinColumns=@JoinColumn(name="adicional_id"))
    @Enumerated(EnumType.STRING) @Column(name="categoria",length=30)
    private Set<Categoria> categorias = new HashSet<>();

    protected Adicional() {}
    public Adicional(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome=nome; }
    public BigDecimal getPreco() { return preco; }
    public void setPreco(BigDecimal preco) { this.preco=preco; }
    public boolean getAtivo() { return ativo; }
    public void setAtivo(boolean ativo) { this.ativo=ativo; }
    public Set<Categoria> getCategorias() { return categorias; }
    public void setCategorias(Set<Categoria> categorias) { this.categorias=categorias; }
}
