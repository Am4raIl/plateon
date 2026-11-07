package japones.dev.plateon.seguranca;

import japones.dev.plateon.compartilhado.Sql;
import java.time.*;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import static org.junit.jupiter.api.Assertions.*;

class AcessoEventosTest {
    @Test void expiracaoEPapelRevogadoInvalidamAssinaturaMesmoAposApagarCredenciais() {
        var ativo=new AtomicBoolean(true);
        var db=new Sql(null) {
            @Override public Map<String,Object> optional(String sql,Object...args) {
                return ativo.get() ? Map.of("id","usuario") : null;
            }
        };
        var agora=Instant.parse("2026-11-06T12:00:00Z");
        var jwt=Jwt.withTokenValue("teste").header("alg","HS256").subject("usuario")
            .claim("papel","COZINHA").issuedAt(agora.minusSeconds(60)).expiresAt(agora.plusSeconds(60)).build();
        var auth=new JwtAuthenticationToken(jwt,List.of(new SimpleGrantedAuthority("ROLE_COZINHA")));
        auth.eraseCredentials();
        var permitido=new AcessoEventos(db,Clock.fixed(agora,ZoneOffset.UTC)).equipe(auth);
        assertTrue(permitido.getAsBoolean());
        ativo.set(false);
        assertFalse(permitido.getAsBoolean());
        ativo.set(true);
        assertFalse(new AcessoEventos(db,Clock.fixed(agora.plusSeconds(60),ZoneOffset.UTC)).equipe(auth).getAsBoolean());
    }
}
