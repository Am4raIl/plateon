package japones.dev.plateon.seguranca;

import japones.dev.plateon.compartilhado.Sql;
import java.time.Clock;
import java.util.Set;
import java.util.function.BooleanSupplier;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
public class AcessoEventos {
    private final Sql db;
    private final Clock clock;
    public AcessoEventos(Sql db,Clock clock) { this.db=db;this.clock=clock; }

    public BooleanSupplier equipe(Authentication auth) {
        if(!(auth instanceof JwtAuthenticationToken autenticacao)) return () -> false;
        String usuarioId=auth.getName();
        var jwt=autenticacao.getToken();
        String papel=jwt.getClaimAsString("papel");
        var expira=jwt.getExpiresAt();
        return () -> papel!=null && expira!=null && clock.instant().isBefore(expira)
            && Set.of("COZINHA","GARCOM","GERENTE").contains(papel)
            && db.optional("SELECT id FROM usuario WHERE id=? AND ativo=1 AND papel=?",usuarioId,papel)!=null;
    }

    public BooleanSupplier tablet(String dispositivoId,String mesaId) {
        return () -> db.optional("SELECT d.id FROM dispositivo d JOIN mesa m ON m.id=d.mesa_id WHERE d.id=? AND d.mesa_id=? AND d.ativo=1 AND m.ativa=1",dispositivoId,mesaId)!=null;
    }
}
