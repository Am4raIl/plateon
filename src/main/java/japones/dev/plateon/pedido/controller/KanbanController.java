package japones.dev.plateon.pedido.controller;

import japones.dev.plateon.pedido.service.PedidoService;
import japones.dev.plateon.pedido.service.KanbanService;
import japones.dev.plateon.pedido.service.PedidoEventos;

import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1")
public class KanbanController {
    private final KanbanService service; private final PedidoEventos events; private final PedidoService pedidos;
    public KanbanController(KanbanService service,PedidoEventos events,PedidoService pedidos) { this.service=service;this.events=events;this.pedidos=pedidos; }
    @Operation(summary="Kanban por estação",description="Filtre por COZINHA ou BAR; um pedido pode conter itens de ambas.")
    @SecurityRequirement(name="equipe")
    @GetMapping("/admin/kanban") public KanbanService.Kanban listar(@RequestParam(required=false) String estacao) { return service.listar(estacao); }
    @Operation(summary="Mudar status do pedido",description="Informe a versão atual do cartão. Exemplo: {\"novoStatus\":\"EM_PREPARO\",\"versao\":2}.")
    @SecurityRequirement(name="equipe")
    @PatchMapping("/admin/kanban/{id}/status") public PedidoService.PedidoView mudar(@PathVariable String id,@Valid @RequestBody KanbanService.Transicao input) { return service.transicao(id,input); }
    @SecurityRequirement(name="equipe")
    @GetMapping("/admin/kanban/eventos") public SseEmitter eventos() { return events.kanban(); }
    @SecurityRequirement(name="tablet")
    @GetMapping("/mesa/pedidos/{id}/eventos") public SseEmitter pedidoEventos(HttpServletRequest request,@PathVariable String id) {
        pedidos.pedido(id,(String)request.getAttribute("mesaId")); return events.pedido(id);
    }
}
