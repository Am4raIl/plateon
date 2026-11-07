package japones.dev.plateon.cardapio.repository;

import japones.dev.plateon.cardapio.domain.Adicional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdicionalRepository extends JpaRepository<Adicional,UUID> {}
