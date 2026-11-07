package japones.dev.plateon.mesa.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;

@Entity
@Table(name="mesa")
public class Mesa {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @Column(name="numero",nullable=false)
    private int numero;
    @Column(name="capacidade",nullable=false)
    private int capacidade;
    @Column(name="ativa",nullable=false)
    private boolean ativa;

    protected Mesa() {}
    public Mesa(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public int getNumero() { return numero; }
    public void setNumero(int numero) { this.numero=numero; }
    public int getCapacidade() { return capacidade; }
    public void setCapacidade(int capacidade) { this.capacidade=capacidade; }
    public boolean getAtiva() { return ativa; }
    public void setAtiva(boolean ativa) { this.ativa=ativa; }
}
