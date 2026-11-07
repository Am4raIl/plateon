package japones.dev.plateon;

import japones.dev.plateon.pedido.service.PedidoEventos;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;

class PedidoEventosTest {
    @RestController
    static class Controller {
        final PedidoEventos eventos=new PedidoEventos();
        final AtomicBoolean autorizado=new AtomicBoolean(true);
        @GetMapping("/eventos") SseEmitter eventos() { return eventos.pedido("pedido-1",autorizado::get); }
    }

    @Test void heartbeatMantemConexaoERevogacaoEncerraAssinatura() throws Exception {
        var controller=new Controller();
        var mvc=MockMvcBuilders.standaloneSetup(controller).build();
        var result=mvc.perform(get("/eventos")).andExpect(request().asyncStarted()).andReturn();
        assertTrue(result.getResponse().getContentAsString().contains("event:conectado"));
        controller.eventos.heartbeat();
        assertTrue(result.getResponse().getContentAsString().contains(":heartbeat"));
        controller.eventos.publicar(new PedidoEventos.Evento("pedido-2","PRONTO"));
        assertFalse(result.getResponse().getContentAsString().contains("PRONTO"));
        controller.eventos.publicar(new PedidoEventos.Evento("pedido-1","RECEBIDO"));
        assertTrue(result.getResponse().getContentAsString().contains("RECEBIDO"));
        controller.autorizado.set(false);
        controller.eventos.heartbeat();
        result.getAsyncResult(1000);
        String encerrado=result.getResponse().getContentAsString();
        controller.autorizado.set(true);
        controller.eventos.publicar(new PedidoEventos.Evento("pedido-1","PRONTO"));
        assertEquals(encerrado,result.getResponse().getContentAsString());
        controller.eventos.encerrar();
    }
}
