package japones.dev.plateon;

import japones.dev.plateon.compartilhado.ApiException;
import japones.dev.plateon.compartilhado.Pagina;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PaginaTest {
    @Test void informaTotaisEProximaPagina() {
        var primeira=Pagina.criar(List.of(1,2),0,2,5);
        assertEquals(List.of(1,2),primeira.itens());
        assertEquals(3,primeira.totalPaginas());
        assertTrue(primeira.temProxima());
        var ultima=Pagina.criar(List.of(5),2,2,5);
        assertEquals(List.of(5),ultima.itens());
        assertFalse(ultima.temProxima());
        assertFalse(Pagina.criar(List.of(),3,2,5).temProxima());
    }

    @Test void rejeitaParametrosForaDosLimites() {
        assertThrows(ApiException.class,() -> Pagina.validar(-1,20));
        assertThrows(ApiException.class,() -> Pagina.validar(0,0));
        assertThrows(ApiException.class,() -> Pagina.validar(0,101));
        assertThrows(ApiException.class,() -> Pagina.validar(1_000_001,20));
    }
}
