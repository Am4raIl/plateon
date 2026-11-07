package japones.dev.plateon;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PlateonApplication {
    public static void main(String[] args) { SpringApplication.run(PlateonApplication.class, args); }
}
