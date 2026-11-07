package japones.dev.plateon.mesa.repository;


import japones.dev.plateon.mesa.domain.Mesa;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MesaRepository extends JpaRepository<Mesa,UUID> {}
