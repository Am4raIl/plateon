package japones.dev.plateon.cardapio.repository;

import japones.dev.plateon.cardapio.domain.Produto;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ProdutoRepository extends JpaRepository<Produto,UUID>, JpaSpecificationExecutor<Produto> {}
