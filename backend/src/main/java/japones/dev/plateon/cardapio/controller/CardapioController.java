package japones.dev.plateon.cardapio.controller;

import japones.dev.plateon.cardapio.domain.Categoria;
import japones.dev.plateon.cardapio.service.CardapioService;
import japones.dev.plateon.compartilhado.Pagina;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
public class CardapioController {
    private final CardapioService service;
    public CardapioController(CardapioService service) { this.service=service; }
    @GetMapping("/produtos") public Pagina<CardapioService.ProdutoView> produtos(@RequestParam(defaultValue="0") int pagina,
        @RequestParam(defaultValue="20") int tamanho,@RequestParam(required=false) Categoria categoria,
        @RequestParam(required=false) Boolean ativo,@RequestParam(required=false) String busca) {
        return service.produtosPaginados(pagina,tamanho,categoria,ativo,busca);
    }
    @GetMapping("/produtos/{id}") public CardapioService.ProdutoView produto(@PathVariable String id) { return service.produto(id); }
    @PostMapping("/produtos") public CardapioService.ProdutoView criar(@Valid @RequestBody CardapioService.ProdutoInput input) { return service.criarProduto(input); }
    @PatchMapping("/produtos/{id}") public CardapioService.ProdutoView atualizar(@PathVariable String id,@Valid @RequestBody CardapioService.ProdutoInput input) { return service.atualizarProduto(id,input); }
    @PatchMapping("/produtos/{id}/disponibilidade") public void disponibilidade(@PathVariable String id,@RequestBody Disponibilidade input) { service.disponibilidade(id,input.disponivel()); }
    @DeleteMapping("/produtos/{id}") public void excluir(@PathVariable String id) { service.desativarProduto(id); }
    @GetMapping("/adicionais") public List<CardapioService.AdicionalView> adicionais() { return service.adicionais(); }
    @GetMapping("/adicionais/{id}") public CardapioService.AdicionalView adicional(@PathVariable String id) { return service.adicional(id); }
    @PostMapping("/adicionais") public CardapioService.AdicionalView criarAdicional(@Valid @RequestBody CardapioService.AdicionalInput input) { return service.criarAdicional(input); }
    @PatchMapping("/adicionais/{id}") public CardapioService.AdicionalView atualizarAdicional(@PathVariable String id,@Valid @RequestBody CardapioService.AdicionalInput input) { return service.atualizarAdicional(id,input); }
    @PutMapping("/adicionais/{id}/categorias") public void categorias(@PathVariable String id,@RequestBody Set<Categoria> categorias) { service.categorias(id,categorias); }
    @DeleteMapping("/adicionais/{id}") public void excluirAdicional(@PathVariable String id) { service.desativarAdicional(id); }
    public record Disponibilidade(boolean disponivel) {}
}
