package japones.dev.plateon.mesa.controller;

import japones.dev.plateon.mesa.service.MesaService;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/mesas")
public class MesaController {
    private final MesaService service;
    public MesaController(MesaService service) { this.service=service; }
    @GetMapping public List<MesaService.MesaView> listar() { return service.listar(); }
    @GetMapping("/{id}") public MesaService.MesaView ver(@PathVariable String id) { return service.ver(id); }
    @PostMapping public MesaService.MesaView criar(@Valid @RequestBody MesaService.MesaInput input) { return service.criar(input); }
    @PatchMapping("/{id}") public MesaService.MesaView atualizar(@PathVariable String id,@Valid @RequestBody MesaService.MesaInput input) { return service.atualizar(id,input); }
    @DeleteMapping("/{id}") public void excluir(@PathVariable String id) { service.excluir(id); }
}
