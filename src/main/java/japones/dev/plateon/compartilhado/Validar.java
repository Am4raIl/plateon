package japones.dev.plateon.compartilhado;

import org.springframework.http.HttpStatus;
import java.math.BigDecimal;

public final class Validar {
    private Validar() {}
    public static void exigir(boolean ok, HttpStatus status, String message) {
        if (!ok) throw new ApiException(status, message);
    }
    public static BigDecimal dinheiro(Object value) { return (BigDecimal) value; }
}
