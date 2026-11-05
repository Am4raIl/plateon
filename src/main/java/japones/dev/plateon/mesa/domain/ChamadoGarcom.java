package japones.dev.plateon.mesa.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;
import japones.dev.plateon.usuario.domain.Usuario;

@Entity
@Table(name="chamado_garcom")
public class ChamadoGarcom {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="mesa_id")
    private Mesa mesa;
    @Enumerated(EnumType.STRING)
    @Column(name="tipo",length=20,nullable=false)
    private ChamadoTipo tipo;
    @Enumerated(EnumType.STRING)
    @Column(name="status",length=20,nullable=false)
    private ChamadoStatus status;
    @Column(name="criado_em",nullable=false)
    private Instant criadoEm;
    @Column(name="atendido_em")
    private Instant atendidoEm;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="atendido_por")
    private Usuario atendidoPor;

    protected ChamadoGarcom() {}
    public ChamadoGarcom(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public Mesa getMesa() { return mesa; }
    public void setMesa(Mesa mesa) { this.mesa=mesa; }
    public ChamadoTipo getTipo() { return tipo; }
    public void setTipo(ChamadoTipo tipo) { this.tipo=tipo; }
    public ChamadoStatus getStatus() { return status; }
    public void setStatus(ChamadoStatus status) { this.status=status; }
    public Instant getCriadoEm() { return criadoEm; }
    public void setCriadoEm(Instant criadoEm) { this.criadoEm=criadoEm; }
    public Instant getAtendidoEm() { return atendidoEm; }
    public void setAtendidoEm(Instant atendidoEm) { this.atendidoEm=atendidoEm; }
    public Usuario getAtendidoPor() { return atendidoPor; }
    public void setAtendidoPor(Usuario atendidoPor) { this.atendidoPor=atendidoPor; }
}
