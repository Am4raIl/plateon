package japones.dev.plateon.pedido.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;
import japones.dev.plateon.conta.domain.Comanda;

@Entity
@Table(name="pedido")
public class Pedido {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="comanda_id")
    private Comanda comanda;
    @Enumerated(EnumType.STRING)
    @Column(name="status",length=20,nullable=false)
    private PedidoStatus status;
    @Column(name="numero_diario")
    private Integer numeroDiario;
    @Column(name="dia_operacional")
    private LocalDate diaOperacional;
    @Column(name="observacao_geral",columnDefinition="text")
    private String observacaoGeral;
    @Column(name="criado_em",nullable=false)
    private Instant criadoEm;
    @Column(name="atualizado_em",nullable=false)
    private Instant atualizadoEm;
    @Column(name="enviado_em")
    private Instant enviadoEm;
    @Version
    @Column(name="version",nullable=false)
    private long version;

    protected Pedido() {}
    public Pedido(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public Comanda getComanda() { return comanda; }
    public void setComanda(Comanda comanda) { this.comanda=comanda; }
    public PedidoStatus getStatus() { return status; }
    public void setStatus(PedidoStatus status) { this.status=status; }
    public Integer getNumeroDiario() { return numeroDiario; }
    public void setNumeroDiario(Integer numeroDiario) { this.numeroDiario=numeroDiario; }
    public LocalDate getDiaOperacional() { return diaOperacional; }
    public void setDiaOperacional(LocalDate diaOperacional) { this.diaOperacional=diaOperacional; }
    public String getObservacaoGeral() { return observacaoGeral; }
    public void setObservacaoGeral(String observacaoGeral) { this.observacaoGeral=observacaoGeral; }
    public Instant getCriadoEm() { return criadoEm; }
    public void setCriadoEm(Instant criadoEm) { this.criadoEm=criadoEm; }
    public Instant getAtualizadoEm() { return atualizadoEm; }
    public void setAtualizadoEm(Instant atualizadoEm) { this.atualizadoEm=atualizadoEm; }
    public Instant getEnviadoEm() { return enviadoEm; }
    public void setEnviadoEm(Instant enviadoEm) { this.enviadoEm=enviadoEm; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version=version; }
}
