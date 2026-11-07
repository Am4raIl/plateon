package japones.dev.plateon.cardapio.service;

import japones.dev.plateon.cardapio.domain.Categoria;
import japones.dev.plateon.compartilhado.Sql;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.UUID;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class ImagemProdutoStore {
    private static final String PREFIX = "/api/v1/imagens/produtos/";
    private final Path directory;
    private final Sql db;

    public ImagemProdutoStore(@Value("${restaurante.imagens.diretorio:./data/product-images}") String directory, Sql db) {
        this.directory = Path.of(directory).toAbsolutePath().normalize();
        this.db = db;
    }

    public String criar(UUID id, Categoria categoria) {
        String url = PREFIX + id + ".svg";
        String cor = switch (categoria) {
            case BEBIDAS -> "#3b82f6";
            case SOBREMESAS -> "#d946ef";
            case HAMBURGUERES -> "#f97316";
            case PIZZAS -> "#ef4444";
            default -> "#16a34a";
        };
        String svg = """
            <svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
              <rect width="480" height="320" fill="%s"/>
              <circle cx="240" cy="160" r="106" fill="#ffffff" opacity=".18"/>
              <circle cx="240" cy="160" r="77" fill="#ffffff" opacity=".86"/>
              <circle cx="240" cy="160" r="54" fill="%s" opacity=".75"/>
            </svg>
            """.formatted(cor, cor);
        try {
            Files.createDirectories(directory);
            Files.writeString(directory.resolve(id + ".svg"), svg, StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException ex) { throw new IllegalStateException("Falha ao salvar imagem do produto", ex); }
        return url;
    }

    public void apagarAposCommit(String url) {
        if (url == null || !url.startsWith(PREFIX)) return;
        UUID id;
        try {
            String name = url.substring(PREFIX.length());
            if (!name.matches("[0-9a-fA-F-]{36}\\.svg")) return;
            id = UUID.fromString(name.substring(0, 36));
        } catch (IllegalArgumentException ex) { return; }
        Path file = directory.resolve(id + ".svg");
        Runnable deletion = () -> {
            try { Files.deleteIfExists(file); }
            catch (IOException ex) { throw new IllegalStateException("Falha ao apagar imagem do produto", ex); }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { deletion.run(); }
            });
        else deletion.run();
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(fixedDelay = 300000, initialDelay = 300000)
    public void limparOrfas() {
        if (!Files.isDirectory(directory)) return;
        Set<String> usadas = db.jdbc().queryForList("SELECT imagem_url FROM produto WHERE imagem_url IS NOT NULL", String.class)
            .stream().filter(url -> url.startsWith(PREFIX)).collect(Collectors.toSet());
        try (var files = Files.list(directory)) {
            for (Path file : files.filter(Files::isRegularFile).filter(p -> p.getFileName().toString().matches("[0-9a-fA-F-]{36}\\.svg")).toList()) {
                if (!usadas.contains(PREFIX + file.getFileName())) Files.deleteIfExists(file);
            }
        } catch (IOException ex) { throw new IllegalStateException("Falha ao limpar imagens órfãs", ex); }
    }

    @RestController
    public static class Controller {
        private final ImagemProdutoStore store;
        public Controller(ImagemProdutoStore store) { this.store = store; }
        @GetMapping(PREFIX + "{id}.svg")
        public ResponseEntity<byte[]> imagem(@PathVariable UUID id) throws IOException {
            Path file = store.directory.resolve(id + ".svg");
            if (!Files.isRegularFile(file)) return ResponseEntity.notFound().build();
            return ResponseEntity.ok().contentType(MediaType.valueOf("image/svg+xml"))
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                .body(Files.readAllBytes(file));
        }
    }
}
