package japones.dev.plateon.seguranca;

import java.time.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;

class RateLimitTest {
    private final SecurityConfig.RateLimitFilter filtro=new SecurityConfig.RateLimitFilter(
        Clock.fixed(Instant.parse("2026-11-06T12:00:15Z"),ZoneOffset.UTC));

    private MockHttpServletResponse requisicao(String metodo,String path) throws Exception {
        var request=new MockHttpServletRequest(metodo,path);
        request.setRemoteAddr("192.0.2.1");
        var response=new MockHttpServletResponse();
        filtro.doFilter(request,response,(req,res) -> {});
        return response;
    }

    @Test void pollingTemCotaPropriaSemBloquearLoginOuOutrosTablets() throws Exception {
        String path="/api/v1/dispositivos/pareamento/solicitacao-1";
        for(int n=0;n<60;n++) assertEquals(200,requisicao("GET",path).getStatus());
        var bloqueada=requisicao("GET",path);
        assertEquals(429,bloqueada.getStatus());
        assertEquals("45",bloqueada.getHeader("Retry-After"));
        assertEquals(200,requisicao("GET","/api/v1/dispositivos/pareamento/solicitacao-2").getStatus());
        for(int n=0;n<10;n++) {
            assertEquals(200,requisicao("POST","/api/v1/auth/login").getStatus());
            assertEquals(200,requisicao("POST","/api/v1/dispositivos/pareamento").getStatus());
        }
        assertEquals(429,requisicao("POST","/api/v1/auth/login").getStatus());
        assertEquals(429,requisicao("POST","/api/v1/dispositivos/pareamento").getStatus());
    }

    @Test void preflightNaoConsomeCotaDeAutenticacao() throws Exception {
        for(int n=0;n<20;n++) assertEquals(200,requisicao("OPTIONS","/api/v1/auth/login").getStatus());
        assertEquals(200,requisicao("POST","/api/v1/auth/login").getStatus());
    }

    @Test void trocarIdDaSolicitacaoNaoPermitePollingIlimitado() throws Exception {
        for(int n=0;n<600;n++) assertEquals(200,requisicao("GET","/api/v1/dispositivos/pareamento/"+n).getStatus());
        assertEquals(429,requisicao("GET","/api/v1/dispositivos/pareamento/outra").getStatus());
        assertEquals(200,requisicao("POST","/api/v1/auth/login").getStatus());
    }
}
