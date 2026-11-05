package japones.dev.plateon.compartilhado;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Component
public class Sql {
    private final JdbcTemplate jdbc;
    public Sql(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public JdbcTemplate jdbc() { return jdbc; }
    public String id() { return UUID.randomUUID().toString(); }
    public Timestamp ts(Instant instant) { return instant == null ? null : Timestamp.from(instant); }
    public Map<String,Object> one(String sql, Object... args) {
        var rows = jdbc.queryForList(sql, args);
        if (rows.isEmpty()) throw new ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "Registro não encontrado");
        return rows.getFirst();
    }
    public Map<String,Object> optional(String sql, Object... args) {
        var rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.getFirst();
    }
    public String str(Map<String,Object> row, String field) { return Objects.toString(row.get(field), null); }
    public Instant instant(Map<String,Object> row, String field) {
        var value = row.get(field);
        if(value==null) return null;
        if(value instanceof Timestamp timestamp) return timestamp.toInstant();
        if(value instanceof java.time.LocalDateTime local) return local.toInstant(java.time.ZoneOffset.UTC);
        if(value instanceof Instant instant) return instant;
        throw new IllegalArgumentException("Tipo de data inesperado: "+value.getClass());
    }
}
