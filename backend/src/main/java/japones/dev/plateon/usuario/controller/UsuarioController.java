package japones.dev.plateon.usuario.controller;

import japones.dev.plateon.usuario.service.UsuarioService;
import japones.dev.plateon.compartilhado.Pagina;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/usuarios")
public class UsuarioController {
    private final UsuarioService service;
    public UsuarioController(UsuarioService service) { this.service=service; }
    @GetMapping public Pagina<UsuarioService.UsuarioView> listar(@RequestParam(defaultValue="0") int pagina,
        @RequestParam(defaultValue="20") int tamanho) { return service.listar(pagina,tamanho); }
    @GetMapping("/{id}") public UsuarioService.UsuarioView ver(@PathVariable String id) { return service.ver(id); }
    @PostMapping public UsuarioService.UsuarioView criar(@Valid @RequestBody UsuarioService.UsuarioInput input) { return service.criar(input); }
    @PatchMapping("/{id}") public UsuarioService.UsuarioView atualizar(@PathVariable String id,@Valid @RequestBody UsuarioService.UsuarioInput input) { return service.atualizar(id,input); }
    @DeleteMapping("/{id}") public void excluir(@PathVariable String id) { service.excluir(id); }
}
