package japones.dev.plateon.usuario.domain;


import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.*;

@Entity
@Table(name="usuario")
public class Usuario {
    @Id @UuidGenerator(style=UuidGenerator.Style.TIME) @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name="id",columnDefinition="char(36)")
    private UUID id;
    @Column(name="nome",length=120,nullable=false)
    private String nome;
    @Column(name="username",length=80,nullable=false)
    private String username;
    @Column(name="senha_hash",length=100,nullable=false)
    private String senhaHash;
    @Enumerated(EnumType.STRING)
    @Column(name="papel",length=20,nullable=false)
    private Papel papel;
    @Column(name="ativo",nullable=false)
    private boolean ativo;

    protected Usuario() {}
    public Usuario(UUID id) { this.id=id; }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id=id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome=nome; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username=username; }
    public String getSenhaHash() { return senhaHash; }
    public void setSenhaHash(String senhaHash) { this.senhaHash=senhaHash; }
    public Papel getPapel() { return papel; }
    public void setPapel(Papel papel) { this.papel=papel; }
    public boolean getAtivo() { return ativo; }
    public void setAtivo(boolean ativo) { this.ativo=ativo; }
}
