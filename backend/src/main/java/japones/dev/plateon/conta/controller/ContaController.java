package japones.dev.plateon.conta.controller;

import japones.dev.plateon.conta.service.ContaService;

import japones.dev.plateon.pedido.service.PedidoService;
import japones.dev.plateon.compartilhado.Pagina;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/comandas")
@SecurityRequirement(name="equipe")
public class ContaController {
    private final ContaService service; private final PedidoService pedidos;
    public ContaController(ContaService service,PedidoService pedidos) { this.service=service;this.pedidos=pedidos; }
    public record Abrir(@NotBlank String mesaId) {}
    @GetMapping public Pagina<PedidoService.ComandaView> listar(@RequestParam(defaultValue="0") int pagina,
        @RequestParam(defaultValue="20") int tamanho,@RequestParam(required=false) String status) { return service.listar(pagina,tamanho,status); }
    @PostMapping public PedidoService.ComandaView abrir(@Valid @RequestBody Abrir input) { return service.abrir(input.mesaId()); }
    @Operation(summary="Resumo paginado das comandas sem carregar pedidos e itens")
    @GetMapping("/resumos") public Pagina<japones.dev.plateon.conta.service.ComandaConsulta.Resumo> resumos(
        @RequestParam(defaultValue="0") int pagina,@RequestParam(defaultValue="20") int tamanho,
        @RequestParam(required=false) String status) { return service.resumos(pagina,tamanho,status); }
    @GetMapping("/{id}") public PedidoService.ComandaView ver(@PathVariable String id) { return pedidos.comandaPorId(id); }
    @Operation(summary="Fechar comanda",description="Pagamentos aplicados devem somar exatamente o total. Em dinheiro, valorRecebido pode superar valor para calcular troco. Exemplo: {\"pagamentos\":[{\"forma\":\"PIX\",\"valor\":17.60}],\"removerTaxa\":false,\"removerCouvert\":false,\"forcar\":false}.")
    @PostMapping("/{id}/fechar") public ContaService.FechamentoView fechar(@PathVariable String id,@Valid @RequestBody ContaService.Fechamento input) { return service.fechar(id,input); }
    @PostMapping("/{id}/retomar") public PedidoService.ComandaView retomar(@PathVariable String id) { return service.retomar(id); }
    @PostMapping("/{id}/reabrir") public PedidoService.ComandaView reabrir(@PathVariable String id,@Valid @RequestBody ContaService.Reabertura input) { return service.reabrir(id,input); }
}
