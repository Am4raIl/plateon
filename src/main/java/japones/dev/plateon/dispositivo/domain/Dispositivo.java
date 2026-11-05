package japones.dev.plateon.dispositivo.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;
import japones.dev.plateon.mesa.domain.Mesa;

@Entity
@Table(name="dispositivo")
public class Dispositivo {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="mesa_id")
    private Mesa mesa;
    @Column(name="nome",length=120,nullable=false)
    private String nome;
    @Column(name="token_hash",columnDefinition="char(64)",nullable=false)
    private String tokenHash;
    @Column(name="ativo",nullable=false)
    private boolean ativo;
    @Column(name="pareado_em",nullable=false)
    private Instant pareadoEm;
    @Column(name="ultimo_acesso_em")
    private Instant ultimoAcessoEm;
    @Column(name="revogado_em")
    private Instant revogadoEm;

    protected Dispositivo() {}
    public Dispositivo(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public Mesa getMesa() { return mesa; }
    public void setMesa(Mesa mesa) { this.mesa=mesa; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome=nome; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash=tokenHash; }
    public boolean getAtivo() { return ativo; }
    public void setAtivo(boolean ativo) { this.ativo=ativo; }
    public Instant getPareadoEm() { return pareadoEm; }
    public void setPareadoEm(Instant pareadoEm) { this.pareadoEm=pareadoEm; }
    public Instant getUltimoAcessoEm() { return ultimoAcessoEm; }
    public void setUltimoAcessoEm(Instant ultimoAcessoEm) { this.ultimoAcessoEm=ultimoAcessoEm; }
    public Instant getRevogadoEm() { return revogadoEm; }
    public void setRevogadoEm(Instant revogadoEm) { this.revogadoEm=revogadoEm; }
}
