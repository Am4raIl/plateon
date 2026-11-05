package japones.dev.plateon.conta.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import japones.dev.plateon.usuario.domain.Usuario;

@Entity
@Table(name="pagamento")
public class Pagamento {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="comanda_id")
    private Comanda comanda;
    @Enumerated(EnumType.STRING)
    @Column(name="forma",length=20,nullable=false)
    private FormaPagamento forma;
    @Column(name="valor",precision=10,scale=2,nullable=false)
    private BigDecimal valor;
    @Column(name="registrado_em",nullable=false)
    private Instant registradoEm;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="registrado_por")
    private Usuario registradoPor;

    protected Pagamento() {}
    public Pagamento(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public Comanda getComanda() { return comanda; }
    public void setComanda(Comanda comanda) { this.comanda=comanda; }
    public FormaPagamento getForma() { return forma; }
    public void setForma(FormaPagamento forma) { this.forma=forma; }
    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor=valor; }
    public Instant getRegistradoEm() { return registradoEm; }
    public void setRegistradoEm(Instant registradoEm) { this.registradoEm=registradoEm; }
    public Usuario getRegistradoPor() { return registradoPor; }
    public void setRegistradoPor(Usuario registradoPor) { this.registradoPor=registradoPor; }
}
