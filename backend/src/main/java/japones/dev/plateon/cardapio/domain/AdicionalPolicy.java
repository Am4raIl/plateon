package japones.dev.plateon.cardapio.domain;

import japones.dev.plateon.cardapio.domain.Categoria;

import japones.dev.plateon.compartilhado.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.util.Set;

@Component
public class AdicionalPolicy {
    public boolean permitido(Categoria categoria, boolean ativo, Set<Categoria> categorias) {
        return categoria.aceitaAdicionais() && ativo && categorias.contains(categoria);
    }
    public void validar(Categoria categoria, boolean ativo, Set<Categoria> categorias) {
        if (!permitido(categoria,ativo,categorias))
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,"Adicional não permitido para este produto");
    }
}
