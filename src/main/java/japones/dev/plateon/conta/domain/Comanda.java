package japones.dev.plateon.conta.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import japones.dev.plateon.mesa.domain.Mesa;

@Entity
@Table(name="comanda")
public class Comanda {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="mesa_id")
    private Mesa mesa;
    @Enumerated(EnumType.STRING)
    @Column(name="status",length=30,nullable=false)
    private ComandaStatus status;
    @Column(name="aberta_em",nullable=false)
    private Instant abertaEm;
    @Column(name="fechada_em")
    private Instant fechadaEm;
    @Column(name="taxa_servico_percentual",precision=5,scale=2,nullable=false)
    private BigDecimal taxaServicoPercentual;
    @Column(name="couvert",precision=10,scale=2,nullable=false)
    private BigDecimal couvert;
    @Column(name="subtotal_fechamento",precision=18,scale=2)
    private BigDecimal subtotalFechamento;
    @Column(name="taxa_fechamento",precision=18,scale=2)
    private BigDecimal taxaFechamento;
    @Column(name="total_fechamento",precision=18,scale=2)
    private BigDecimal totalFechamento;

    protected Comanda() {}
    public Comanda(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public Mesa getMesa() { return mesa; }
    public void setMesa(Mesa mesa) { this.mesa=mesa; }
    public ComandaStatus getStatus() { return status; }
    public void setStatus(ComandaStatus status) { this.status=status; }
    public Instant getAbertaEm() { return abertaEm; }
    public void setAbertaEm(Instant abertaEm) { this.abertaEm=abertaEm; }
    public Instant getFechadaEm() { return fechadaEm; }
    public void setFechadaEm(Instant fechadaEm) { this.fechadaEm=fechadaEm; }
    public BigDecimal getTaxaServicoPercentual() { return taxaServicoPercentual; }
    public void setTaxaServicoPercentual(BigDecimal taxaServicoPercentual) { this.taxaServicoPercentual=taxaServicoPercentual; }
    public BigDecimal getCouvert() { return couvert; }
    public void setCouvert(BigDecimal couvert) { this.couvert=couvert; }
    public BigDecimal getSubtotalFechamento() { return subtotalFechamento; }
    public BigDecimal getTaxaFechamento() { return taxaFechamento; }
    public BigDecimal getTotalFechamento() { return totalFechamento; }
}
