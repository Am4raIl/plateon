package japones.dev.plateon.pedido.service;


import java.io.IOException;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class PedidoEventos {
    public record Evento(String pedidoId,String status) {}
    private final List<SseEmitter> kanban=new CopyOnWriteArrayList<>();
    private final Map<String,List<SseEmitter>> pedidos=new java.util.concurrent.ConcurrentHashMap<>();
    public SseEmitter kanban() { return registrar(kanban); }
    public SseEmitter pedido(String id) { return registrar(pedidos.computeIfAbsent(id,k -> new CopyOnWriteArrayList<>())); }
    private SseEmitter registrar(List<SseEmitter> lista) {
        var emitter=new SseEmitter(0L); lista.add(emitter);
        emitter.onCompletion(() -> lista.remove(emitter)); emitter.onTimeout(() -> lista.remove(emitter));
        try { emitter.send(SseEmitter.event().name("conectado").data(Map.of("ok",true))); }
        catch(IOException ex) { lista.remove(emitter); }
        return emitter;
    }
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT)
    public void publicar(Evento evento) {
        enviar(kanban,evento);
        enviar(pedidos.getOrDefault(evento.pedidoId(),List.of()),evento);
    }
    private void enviar(List<SseEmitter> lista,Evento evento) {
        for(var emitter:lista) try { emitter.send(SseEmitter.event().name("pedido").data(evento)); }
        catch(IOException ex) { lista.remove(emitter); emitter.complete(); }
    }
}
