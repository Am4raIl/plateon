package japones.dev.plateon.compartilhado;

import org.springframework.http.HttpStatus;
import java.util.Map;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final Map<String, Object> details;
    public ApiException(HttpStatus status, String message) { this(status, message, Map.of()); }
    public ApiException(HttpStatus status, String message, Map<String, Object> details) {
        super(message); this.status = status; this.details = details;
    }
    public HttpStatus status() { return status; }
    public Map<String, Object> details() { return details; }
}
