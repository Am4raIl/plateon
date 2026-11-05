package japones.dev.plateon.pedido.controller;

import japones.dev.plateon.pedido.service.PedidoService;

import japones.dev.plateon.cardapio.service.CardapioService;
import japones.dev.plateon.cardapio.domain.Categoria;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/mesa")
@SecurityRequirement(name="tablet")
public class MesaPedidoController {
    private final PedidoService pedidos; private final CardapioService cardapio;
    public MesaPedidoController(PedidoService pedidos,CardapioService cardapio) { this.pedidos=pedidos; this.cardapio=cardapio; }
    private String mesa(HttpServletRequest request) { return (String)request.getAttribute("mesaId"); }
    @GetMapping("/estado") public PedidoService.EstadoMesa estado(HttpServletRequest request) { return pedidos.estado(mesa(request),(Integer)request.getAttribute("numeroMesa")); }
    @GetMapping("/cardapio") public List<CardapioService.ProdutoView> cardapio(@RequestParam(required=false) Categoria categoria,
        @RequestParam(required=false) String busca) { return cardapio.cardapio(categoria,busca); }
    @GetMapping("/comanda") public PedidoService.ComandaView comanda(HttpServletRequest request) { return pedidos.comandaAtual(mesa(request)); }
    @PostMapping("/pedidos") public PedidoService.PedidoView criar(HttpServletRequest request) { return pedidos.rascunho(mesa(request)); }
    @Operation(summary="Adicionar item ao rascunho",description="O preço e os adicionais são validados e calculados no servidor. Exemplo: {\"produtoId\":\"UUID\",\"quantidade\":2,\"observacao\":\"sem cebola\",\"adicionaisIds\":[]}")
    @PostMapping("/pedidos/{id}/itens") public PedidoService.PedidoView item(HttpServletRequest request,@PathVariable String id,@Valid @RequestBody PedidoService.ItemInput input) { return pedidos.adicionar(mesa(request),id,input); }
    @PatchMapping("/pedidos/{id}/itens/{itemId}") public PedidoService.PedidoView alterar(HttpServletRequest request,@PathVariable String id,@PathVariable String itemId,@Valid @RequestBody PedidoService.ItemInput input) { return pedidos.alterarItem(mesa(request),id,itemId,input); }
    @DeleteMapping("/pedidos/{id}/itens/{itemId}") public PedidoService.PedidoView remover(HttpServletRequest request,@PathVariable String id,@PathVariable String itemId) { return pedidos.removerItem(mesa(request),id,itemId); }
    @Operation(summary="Enviar pedido",description="Envio idempotente: repetições devolvem o mesmo número diário. Exemplo: {\"observacaoGeral\":\"sem gelo\"}.")
    @PostMapping("/pedidos/{id}/enviar") public PedidoService.PedidoView enviar(HttpServletRequest request,@PathVariable String id,@RequestBody(required=false) PedidoService.Envio input) { return pedidos.enviar(mesa(request),id,input); }
    @PostMapping("/pedidos/{id}/cancelar") public PedidoService.PedidoView cancelar(HttpServletRequest request,@PathVariable String id) { return pedidos.cancelar(mesa(request),id); }
    @PostMapping("/chamados") public PedidoService.ChamadoView chamado(HttpServletRequest request,@Valid @RequestBody PedidoService.ChamadoInput input) { return pedidos.chamar(mesa(request),input); }
}
