package japones.dev.plateon;

import japones.dev.plateon.cardapio.domain.*;
import japones.dev.plateon.cardapio.service.*;
import japones.dev.plateon.compartilhado.Tempo;
import japones.dev.plateon.pedido.service.KanbanService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class PlateonApplicationTests {
    @Test void diaOperacionalViraAsQuatro() {
        var tempo=new Tempo();
        ReflectionTestUtils.setField(tempo,"fuso","America/Sao_Paulo");
        ReflectionTestUtils.setField(tempo,"virada","04:00");
        assertEquals(LocalDate.of(2026,11,3),tempo.diaOperacional(ZonedDateTime.of(2026,11,4,2,0,0,0,ZoneId.of("America/Sao_Paulo")).toInstant()));
        assertEquals(LocalDate.of(2026,11,4),tempo.diaOperacional(ZonedDateTime.of(2026,11,4,4,0,0,0,ZoneId.of("America/Sao_Paulo")).toInstant()));
    }
    @Test void politicaDeAdicionaisRespeitaCategorias() {
        var policy=new AdicionalPolicy();
        for(var categoria:Categoria.values()) {
            boolean esperado=categoria==Categoria.HAMBURGUERES || categoria==Categoria.PORCOES;
            assertEquals(esperado,policy.permitido(categoria,true,Set.of(Categoria.HAMBURGUERES,Categoria.PORCOES)));
            assertFalse(policy.permitido(categoria,false,Set.of(categoria)));
        }
        assertFalse(policy.permitido(Categoria.SOBREMESAS,true,Set.of(Categoria.HAMBURGUERES,Categoria.PORCOES)));
    }
    @Test void transicoesSaoSequenciais() {
        assertEquals(List.of("EM_PREPARO","CANCELADO"),KanbanService.permitidas("RECEBIDO"));
        assertFalse(KanbanService.permitidas("RECEBIDO").contains("ENTREGUE"));
        assertTrue(KanbanService.permitidas("ENTREGUE").isEmpty());
    }
}
