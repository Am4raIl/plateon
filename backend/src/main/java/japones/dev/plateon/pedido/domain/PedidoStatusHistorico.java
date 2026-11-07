package japones.dev.plateon.pedido.domain;


import jakarta.persistence.*;
import java.time.*;
import japones.dev.plateon.usuario.domain.Usuario;

@Entity
@Table(name="pedido_status_historico")
public class PedidoStatusHistorico {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="pedido_id")
    private Pedido pedido;
    @Enumerated(EnumType.STRING)
    @Column(name="de",length=20)
    private PedidoStatus de;
    @Enumerated(EnumType.STRING)
    @Column(name="para",length=20,nullable=false)
    private PedidoStatus para;
    @Column(name="em",nullable=false)
    private Instant em;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="usuario_id")
    private Usuario usuario;
    @Column(name="motivo",length=500)
    private String motivo;

    protected PedidoStatusHistorico() {}
    public PedidoStatusHistorico(Long id) { this.id=id; }
    public Long getId() { return id; }
    public void setId(Long id) { this.id=id; }
    public Pedido getPedido() { return pedido; }
    public void setPedido(Pedido pedido) { this.pedido=pedido; }
    public PedidoStatus getDe() { return de; }
    public void setDe(PedidoStatus de) { this.de=de; }
    public PedidoStatus getPara() { return para; }
    public void setPara(PedidoStatus para) { this.para=para; }
    public Instant getEm() { return em; }
    public void setEm(Instant em) { this.em=em; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario=usuario; }
    public String getMotivo() { return motivo; }
    public void setMotivo(String motivo) { this.motivo=motivo; }
}
