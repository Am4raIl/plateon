package japones.dev.plateon.relatorio.controller;

import japones.dev.plateon.relatorio.service.DashboardService;

import java.time.LocalDate;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
public class DashboardController {
    private final DashboardService service;
    public DashboardController(DashboardService service) { this.service=service; }
    @GetMapping("/fechamento-diario")
    public DashboardService.FechamentoDiario diario(@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate dia) {
        return service.diario(dia);
    }
}
