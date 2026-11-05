package japones.dev.plateon.usuario.repository;


import japones.dev.plateon.usuario.domain.Usuario;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario,UUID> {}
