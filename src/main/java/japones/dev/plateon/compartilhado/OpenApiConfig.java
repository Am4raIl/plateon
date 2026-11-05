package japones.dev.plateon.compartilhado;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean OpenAPI plateonApi() {
        return new OpenAPI().info(new Info().title("Plateon — pedidos de mesa e KDS").version("v1")
                .description("API alfa para tablets fixos de mesa e equipe do restaurante. Datas em UTC; dia operacional inicia às 04:00 no fuso configurado."))
            .components(new Components()
                .addSecuritySchemes("tablet",new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer")
                    .description("Token do tablet recebido uma vez após o pareamento. Válido apenas em /api/v1/mesa/**."))
                .addSecuritySchemes("equipe",new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")
                    .description("JWT da equipe obtido em /api/v1/auth/login. Válido apenas em /api/v1/admin/**.")));
    }
}
