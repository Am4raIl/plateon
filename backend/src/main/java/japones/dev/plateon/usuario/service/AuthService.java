package japones.dev.plateon.usuario.service;


import japones.dev.plateon.compartilhado.*;
import jakarta.validation.constraints.NotBlank;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final Sql db; private final PasswordEncoder passwords; private final JwtEncoder encoder; private final Clock clock;
    @Value("${restaurante.jwt.expiracao-horas:8}") private long hours;
    public AuthService(Sql db,PasswordEncoder passwords,JwtEncoder encoder,Clock clock) {
        this.db=db;this.passwords=passwords;this.encoder=encoder;this.clock=clock;
    }
    public record Login(@NotBlank String username,@NotBlank String senha) {}
    public record LoginView(String token,Instant expiraEm,String papel) {}
    public LoginView login(Login request) {
        var user=db.optional("SELECT * FROM usuario WHERE username=? AND ativo=1",request.username());
        if(user==null || !passwords.matches(request.senha(),db.str(user,"senha_hash")))
            throw new ApiException(HttpStatus.UNAUTHORIZED,"Credenciais inválidas");
        var now=clock.instant();
        var claims=JwtClaimsSet.builder().subject(db.str(user,"id")).issuedAt(now)
            .expiresAt(now.plus(hours,ChronoUnit.HOURS)).claim("papel",db.str(user,"papel")).build();
        String token=encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),claims)).getTokenValue();
        return new LoginView(token,now.plus(hours,ChronoUnit.HOURS),db.str(user,"papel"));
    }
}
