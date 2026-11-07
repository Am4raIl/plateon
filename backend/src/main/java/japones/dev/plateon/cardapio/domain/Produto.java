package japones.dev.plateon.cardapio.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import japones.dev.plateon.cardapio.domain.Categoria;

@Entity
@Table(name="produto")
public class Produto {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @Column(name="nome",length=120,nullable=false)
    private String nome;
    @Column(name="descricao",columnDefinition="text")
    private String descricao;
    @Enumerated(EnumType.STRING)
    @Column(name="categoria",length=30,nullable=false)
    private Categoria categoria;
    @Column(name="preco",precision=10,scale=2,nullable=false)
    private BigDecimal preco;
    @Column(name="imagem_url",length=1000)
    private String imagemUrl;
    @Enumerated(EnumType.STRING)
    @Column(name="estacao",length=20,nullable=false)
    private Estacao estacao;
    @Column(name="tempo_preparo_estimado_min",nullable=false)
    private int tempoPreparoEstimadoMin;
    @Column(name="disponivel",nullable=false)
    private boolean disponivel;
    @Column(name="ativo",nullable=false)
    private boolean ativo;
    @Version
    @Column(name="version",nullable=false)
    private long version;

    protected Produto() {}
    public Produto(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome=nome; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao=descricao; }
    public Categoria getCategoria() { return categoria; }
    public void setCategoria(Categoria categoria) { this.categoria=categoria; }
    public BigDecimal getPreco() { return preco; }
    public void setPreco(BigDecimal preco) { this.preco=preco; }
    public String getImagemUrl() { return imagemUrl; }
    public void setImagemUrl(String imagemUrl) { this.imagemUrl=imagemUrl; }
    public Estacao getEstacao() { return estacao; }
    public void setEstacao(Estacao estacao) { this.estacao=estacao; }
    public int getTempoPreparoEstimadoMin() { return tempoPreparoEstimadoMin; }
    public void setTempoPreparoEstimadoMin(int tempoPreparoEstimadoMin) { this.tempoPreparoEstimadoMin=tempoPreparoEstimadoMin; }
    public boolean getDisponivel() { return disponivel; }
    public void setDisponivel(boolean disponivel) { this.disponivel=disponivel; }
    public boolean getAtivo() { return ativo; }
    public void setAtivo(boolean ativo) { this.ativo=ativo; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version=version; }
}
