package japones.dev.plateon.pedido.service;


import java.io.IOException;
import java.util.*;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BooleanSupplier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class PedidoEventos {
    public record Evento(String pedidoId,String status) {}
    private record Conexao(String pedidoId,SseEmitter emitter,BooleanSupplier autorizado) {}
    private final Map<UUID,Conexao> conexoes=new ConcurrentHashMap<>();
    public SseEmitter kanban(BooleanSupplier autorizado) { return registrar(null,autorizado); }
    public SseEmitter pedido(String id,BooleanSupplier autorizado) { return registrar(id,autorizado); }
    private SseEmitter registrar(String pedidoId,BooleanSupplier autorizado) {
        japones.dev.plateon.compartilhado.Validar.exigir(autorizado.getAsBoolean(),
            org.springframework.http.HttpStatus.FORBIDDEN,"Acesso ao fluxo de eventos revogado");
        UUID chave=UUID.randomUUID();
        var emitter=new SseEmitter(30*60*1000L);
        var conexao=new Conexao(pedidoId,emitter,autorizado);
        conexoes.put(chave,conexao);
        emitter.onCompletion(() -> conexoes.remove(chave));
        emitter.onTimeout(() -> encerrar(chave,conexao));
        emitter.onError(ex -> encerrar(chave,conexao));
        enviar(chave,conexao,SseEmitter.event().name("conectado").data(Map.of("ok",true)));
        return emitter;
    }
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT)
    public void publicar(Evento evento) {
        conexoes.forEach((chave,c) -> {
            if(c.pedidoId()==null || c.pedidoId().equals(evento.pedidoId()))
                enviar(chave,c,SseEmitter.event().name("pedido").data(evento));
        });
    }
    @Scheduled(fixedDelay=15000)
    public void heartbeat() {
        conexoes.forEach((chave,c) -> enviar(chave,c,SseEmitter.event().comment("heartbeat")));
    }
    private void enviar(UUID chave,Conexao c,SseEmitter.SseEventBuilder evento) {
        try {
            if(!c.autorizado().getAsBoolean()) { encerrar(chave,c); return; }
            c.emitter().send(evento);
        } catch(IOException | RuntimeException ex) {
            // Uma conexão com falha não interrompe as demais notificações após o commit.
            encerrar(chave,c);
        }
    }
    private void encerrar(UUID chave,Conexao c) {
        if(conexoes.remove(chave,c)) c.emitter().complete();
    }
    @PreDestroy
    public void encerrar() { conexoes.forEach(this::encerrar); }
}
