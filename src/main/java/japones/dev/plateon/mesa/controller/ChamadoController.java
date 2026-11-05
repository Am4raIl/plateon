package japones.dev.plateon.mesa.controller;

import japones.dev.plateon.mesa.service.ChamadoService;
import japones.dev.plateon.compartilhado.Pagina;

import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/chamados")
public class ChamadoController {
    private final ChamadoService service;
    public ChamadoController(ChamadoService service) { this.service=service; }
    @GetMapping public Pagina<ChamadoService.ChamadoAdminView> listar(@RequestParam(defaultValue="0") int pagina,
        @RequestParam(defaultValue="20") int tamanho,@RequestParam(required=false) String status) { return service.listar(pagina,tamanho,status); }
    @PatchMapping("/{id}") public ChamadoService.ChamadoAdminView atender(@PathVariable String id,@RequestBody ChamadoService.Atendimento input) { return service.atender(id,input); }
}
