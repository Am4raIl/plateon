package japones.dev.plateon.pedido.domain;


import jakarta.persistence.*;
import java.time.*;

@Entity
@Table(name="contador_diario")
public class ContadorDiario {
    @Id @Column(name="dia_operacional")
    private LocalDate diaOperacional;
    @Column(name="ultimo_numero",nullable=false)
    private int ultimoNumero;

    protected ContadorDiario() {}
    public ContadorDiario(LocalDate diaOperacional) { this.diaOperacional=diaOperacional; }
    public LocalDate getDiaOperacional() { return diaOperacional; }
    public void setDiaOperacional(LocalDate diaOperacional) { this.diaOperacional=diaOperacional; }
    public int getUltimoNumero() { return ultimoNumero; }
    public void setUltimoNumero(int ultimoNumero) { this.ultimoNumero=ultimoNumero; }
}
