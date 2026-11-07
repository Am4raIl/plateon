package japones.dev.plateon.usuario.controller;

import japones.dev.plateon.usuario.service.AuthService;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService service;
    public AuthController(AuthService service) { this.service=service; }
    @PostMapping("/login") public AuthService.LoginView login(@Valid @RequestBody AuthService.Login request) { return service.login(request); }
}
