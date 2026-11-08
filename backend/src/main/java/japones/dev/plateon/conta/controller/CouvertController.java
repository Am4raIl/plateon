package japones.dev.plateon.conta.controller;

import japones.dev.plateon.compartilhado.Sql;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/configuracao/couvert")
@SecurityRequirement(name="equipe")
public class CouvertController {
    private final Sql db;
    public CouvertController(Sql db) { this.db = db; }
    public record CouvertView(BigDecimal valor) {}
    public record CouvertInput(@NotNull @DecimalMin("0.00") @Digits(integer=8, fraction=2) BigDecimal valor) {}
    @GetMapping public CouvertView ver() {
        return new CouvertView((BigDecimal)db.one("SELECT valor FROM configuracao_couvert WHERE id=1").get("valor"));
    }
    @PutMapping public CouvertView atualizar(@Valid @RequestBody CouvertInput input) {
        db.jdbc().update("UPDATE configuracao_couvert SET valor=? WHERE id=1", input.valor());
        return ver();
    }
}
