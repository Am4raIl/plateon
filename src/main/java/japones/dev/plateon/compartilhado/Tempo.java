package japones.dev.plateon.compartilhado;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.*;

@Configuration
public class Tempo {
    @Value("${restaurante.fuso:America/Sao_Paulo}") private String fuso;
    @Value("${restaurante.hora-virada:04:00}") private String virada;
    @Bean public Clock clock() { return Clock.systemUTC(); }
    public LocalDate diaOperacional(Instant instante) {
        return instante.atZone(ZoneId.of(fuso)).minusSeconds(LocalTime.parse(virada).toSecondOfDay()).toLocalDate();
    }
}
