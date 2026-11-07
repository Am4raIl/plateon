package japones.dev.plateon.dispositivo.controller;

import japones.dev.plateon.dispositivo.service.DispositivoService;

import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class DispositivoController {
    private final DispositivoService service;
    public DispositivoController(DispositivoService service) { this.service=service; }
    @Operation(summary="Solicitar pareamento",description="O tablet recebe um código de seis caracteres válido por dez minutos.")
    @PostMapping("/dispositivos/pareamento") public DispositivoService.Solicitacao solicitar() { return service.solicitar(); }
    @GetMapping("/dispositivos/pareamento/{id}") public DispositivoService.EstadoPareamento consultar(@PathVariable String id) { return service.consultar(id); }
    @Operation(summary="Aprovar pareamento",description="Garçom ou gerente escolhe a mesa. Exemplo: {\"codigo\":\"ABC234\",\"mesaId\":\"UUID\"}.")
    @SecurityRequirement(name="equipe")
    @PostMapping("/admin/dispositivos/pareamento/aprovar") public DispositivoService.DispositivoView aprovar(@Valid @RequestBody DispositivoService.Aprovar input) { return service.aprovar(input); }
    @GetMapping("/admin/dispositivos") public List<DispositivoService.DispositivoView> listar() { return service.listar(); }
    @PatchMapping("/admin/dispositivos/{id}") public DispositivoService.DispositivoView atualizar(@PathVariable String id,@RequestBody DispositivoService.DispositivoInput input) { return service.atualizar(id,input); }
    @DeleteMapping("/admin/dispositivos/{id}") public void revogar(@PathVariable String id) { service.revogar(id); }
}
