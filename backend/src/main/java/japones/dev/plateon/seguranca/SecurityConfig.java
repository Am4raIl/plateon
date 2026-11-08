package japones.dev.plateon.seguranca;

import japones.dev.plateon.compartilhado.Sql;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {
    @Bean org.springframework.security.access.hierarchicalroles.RoleHierarchy roleHierarchy() {
        return org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl.fromHierarchy("""
            ROLE_GERENTE > ROLE_GARCOM
            ROLE_GARCOM > ROLE_COZINHA
            """);
    }
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    @Bean JwtEncoder jwtEncoder(@Value("${restaurante.jwt.segredo}") String secret) {
        requireSecret(secret);
        return NimbusJwtEncoder.withSecretKey(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256")).build();
    }
    @Bean JwtDecoder jwtDecoder(@Value("${restaurante.jwt.segredo}") String secret) {
        requireSecret(secret);
        return NimbusJwtDecoder.withSecretKey(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
            .macAlgorithm(MacAlgorithm.HS256).build();
    }
    private void requireSecret(String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalStateException("JWT_SECRET deve ter pelo menos 32 bytes");
    }
    @Bean SecurityFilterChain security(HttpSecurity http, Sql db, Clock clock,
            @Value("${restaurante.cors-origins:}") String origins) throws Exception {
        var dispositivoFilter = new DispositivoFilter(db, clock);
        var rateLimitFilter = new RateLimitFilter(clock);
        var cors = new CorsConfiguration();
        if (!origins.isBlank()) cors.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).toList());
        cors.setAllowedMethods(List.of("GET","POST","PATCH","PUT","DELETE","OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization","Content-Type"));
        cors.setExposedHeaders(List.of("Retry-After"));
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        var defaultResolver = new DefaultBearerTokenResolver();
        http.csrf(csrf -> csrf.disable())
            .cors(c -> c.configurationSource(source))
            .exceptionHandling(e -> e
                .authenticationEntryPoint((request,response,ex) -> problem(response,401,"Não autenticado"))
                .accessDeniedHandler((request,response,ex) -> problem(response,403,"Acesso negado")))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .securityContext(s -> s.securityContextRepository(new RequestAttributeSecurityContextRepository()))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health", "/actuator/info", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/imagens/produtos/*.svg").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/dispositivos/pareamento").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/dispositivos/pareamento/*").permitAll()
                .requestMatchers("/api/v1/mesa/**").hasRole("DISPOSITIVO")
                .requestMatchers(HttpMethod.GET, "/api/v1/admin/mesas", "/api/v1/admin/dispositivos").hasAnyRole("GARCOM","GERENTE")
                .requestMatchers(HttpMethod.DELETE, "/api/v1/admin/dispositivos/*").hasAnyRole("GARCOM","GERENTE")
                .requestMatchers("/api/v1/admin/kanban/**").hasAnyRole("COZINHA","GARCOM","GERENTE")
                .requestMatchers("/api/v1/admin/chamados/**", "/api/v1/admin/dispositivos/pareamento/**").hasAnyRole("GARCOM","GERENTE")
                .requestMatchers("/api/v1/admin/comandas/**").hasAnyRole("GARCOM","GERENTE")
                .requestMatchers("/api/v1/admin/**").hasRole("GERENTE")
                .anyRequest().denyAll())
            .oauth2ResourceServer(o -> o.bearerTokenResolver(request -> request.getRequestURI().startsWith("/api/v1/admin/") ? defaultResolver.resolve(request) : null)
                .authenticationEntryPoint((request,response,ex) -> problem(response,401,"Token inválido ou expirado"))
                .jwt(j -> j.jwtAuthenticationConverter(jwt -> {
                    String role = jwt.getClaimAsString("papel");
                    return new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken(jwt,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                })));
        http.addFilterBefore(rateLimitFilter, BearerTokenAuthenticationFilter.class);
        http.addFilterBefore(dispositivoFilter, BearerTokenAuthenticationFilter.class);
        http.addFilterBefore(new PedidoMdcFilter(), BearerTokenAuthenticationFilter.class);
        return http.build();
    }
    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) { throw new IllegalStateException(ex); }
    }
    public static class DispositivoFilter extends OncePerRequestFilter {
        private final Sql db; private final Clock clock;
        DispositivoFilter(Sql db, Clock clock) { this.db = db; this.clock = clock; }
        @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            if (request.getRequestURI().startsWith("/api/v1/mesa/")) {
                String header = request.getHeader("Authorization");
                String token = header != null && header.startsWith("Bearer ") ? header.substring(7) : "";
                var row = db.optional("SELECT d.id, d.mesa_id, d.ultimo_acesso_em, m.numero FROM dispositivo d JOIN mesa m ON m.id=d.mesa_id WHERE d.token_hash=? AND d.ativo=1 AND m.ativa=1", hash(token));
                if (row == null) { problem(response,401,"Tablet não autorizado"); return; }
                request.setAttribute("mesaId", row.get("mesa_id"));
                request.setAttribute("numeroMesa", row.get("numero"));
                org.slf4j.MDC.put("numeroMesa", row.get("numero").toString());
                var last = db.instant(row, "ultimo_acesso_em");
                if (last == null || last.isBefore(clock.instant().minusSeconds(30)))
                    db.jdbc().update("UPDATE dispositivo SET ultimo_acesso_em=? WHERE id=? AND (ultimo_acesso_em IS NULL OR ultimo_acesso_em<?)",
                        db.ts(clock.instant()), row.get("id"),db.ts(clock.instant().minusSeconds(30)));
                var contexto=SecurityContextHolder.createEmptyContext();
                contexto.setAuthentication(new UsernamePasswordAuthenticationToken(row.get("id"),null,
                    List.of(new SimpleGrantedAuthority("ROLE_DISPOSITIVO"))));
                SecurityContextHolder.setContext(contexto);
                // Preserva autenticação apenas nesta requisição, inclusive no encerramento assíncrono do SSE.
                new RequestAttributeSecurityContextRepository().saveContext(contexto,request,response);
            }
            try { chain.doFilter(request, response); } finally { org.slf4j.MDC.remove("numeroMesa"); }
        }
    }
    public static class RateLimitFilter extends OncePerRequestFilter {
        private final Clock clock;
        private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
        RateLimitFilter(Clock clock) { this.clock = clock; }
        record Window(long minute, int count) {}
        @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            String path = request.getRequestURI();
            String operacao=null;
            int limite=10;
            if (request.getMethod().equals("POST") && path.equals("/api/v1/auth/login")) operacao="login";
            else if (request.getMethod().equals("POST") && path.equals("/api/v1/dispositivos/pareamento")) operacao="pareamento";
            else if (request.getMethod().equals("GET") && path.startsWith("/api/v1/dispositivos/pareamento/")) {
                // Tablets atrás do mesmo IP têm cotas de polling independentes por solicitação.
                operacao="consulta:"+path.substring("/api/v1/dispositivos/pareamento/".length());
                limite=60;
            }
            if (operacao!=null) {
                String key = operacao+":"+request.getRemoteAddr();
                long minute = clock.instant().getEpochSecond()/60;
                boolean excedeuTotal=false;
                if(operacao.startsWith("consulta:")) {
                    var global=windows.compute("consultas:"+request.getRemoteAddr(),
                        (k,v) -> v == null || v.minute != minute ? new Window(minute,1) : new Window(minute,v.count+1));
                    excedeuTotal=global.count>600;
                }
                Window next = excedeuTotal ? null : windows.compute(key, (k,v) -> v == null || v.minute != minute ? new Window(minute,1) : new Window(minute,v.count+1));
                if (excedeuTotal || next.count > limite) {
                    response.setHeader("Retry-After",Long.toString(60-clock.instant().getEpochSecond()%60));
                    problem(response,429,"Limite de requisições excedido"); return;
                }
                if (windows.size() > 10000) windows.entrySet().removeIf(e -> e.getValue().minute < minute-2);
            }
            chain.doFilter(request,response);
        }
    }
    public static class PedidoMdcFilter extends OncePerRequestFilter {
        private static final java.util.regex.Pattern PEDIDO=java.util.regex.Pattern.compile("/api/v1/(?:mesa/pedidos|admin/kanban)/([0-9a-fA-F-]{36})(?:/.*)?");
        @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)
                throws ServletException,IOException {
            var matcher=PEDIDO.matcher(request.getRequestURI());
            if(matcher.matches()) org.slf4j.MDC.put("pedidoId",matcher.group(1));
            try { chain.doFilter(request,response); } finally { org.slf4j.MDC.remove("pedidoId"); }
        }
    }
    private static void problem(HttpServletResponse response,int status,String detail) throws IOException {
        response.setStatus(status);
        if(status==401) response.setHeader("WWW-Authenticate","Bearer");
        response.setContentType("application/problem+json;charset=UTF-8");
        response.getWriter().write("{\"status\":"+status+",\"detail\":\""+detail+"\"}");
    }
}
