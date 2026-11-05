package japones.dev.plateon.dispositivo.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;

@Entity
@Table(name="solicitacao_pareamento")
public class SolicitacaoPareamento {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @Column(name="codigo",columnDefinition="char(6)",nullable=false)
    private String codigo;
    @Enumerated(EnumType.STRING)
    @Column(name="status",length=20,nullable=false)
    private PareamentoStatus status;
    @Column(name="criada_em",nullable=false)
    private Instant criadaEm;
    @Column(name="expira_em",nullable=false)
    private Instant expiraEm;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="dispositivo_id")
    private Dispositivo dispositivo;

    protected SolicitacaoPareamento() {}
    public SolicitacaoPareamento(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo=codigo; }
    public PareamentoStatus getStatus() { return status; }
    public void setStatus(PareamentoStatus status) { this.status=status; }
    public Instant getCriadaEm() { return criadaEm; }
    public void setCriadaEm(Instant criadaEm) { this.criadaEm=criadaEm; }
    public Instant getExpiraEm() { return expiraEm; }
    public void setExpiraEm(Instant expiraEm) { this.expiraEm=expiraEm; }
    public Dispositivo getDispositivo() { return dispositivo; }
    public void setDispositivo(Dispositivo dispositivo) { this.dispositivo=dispositivo; }
}
