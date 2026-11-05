package japones.dev.plateon;

import japones.dev.plateon.cardapio.domain.Categoria;
import japones.dev.plateon.cardapio.service.ImagemProdutoStore;
import java.nio.file.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.junit.jupiter.api.Assertions.*;

class ImagemProdutoStoreTest {
    @TempDir Path directory;

    @Test void apagaImagemSomenteAposCommit() throws Exception {
        var store = new ImagemProdutoStore(directory.toString(), null);
        UUID id = UUID.randomUUID();
        String url = store.criar(id, Categoria.HAMBURGUERES);
        Path file = directory.resolve(id + ".svg");
        assertTrue(Files.exists(file));
        assertEquals(200, new ImagemProdutoStore.Controller(store).imagem(id).getStatusCode().value());
        TransactionSynchronizationManager.initSynchronization();
        try {
            store.apagarAposCommit(url);
            assertTrue(Files.exists(file));
            TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit());
            assertFalse(Files.exists(file));
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }

    @Test void urlExternaNaoApagaArquivoLocal() {
        var store = new ImagemProdutoStore(directory.toString(), null);
        UUID id = UUID.randomUUID();
        store.criar(id, Categoria.BEBIDAS);
        store.apagarAposCommit("https://exemplo.com/" + id + ".svg");
        assertTrue(Files.exists(directory.resolve(id + ".svg")));
    }

    @Test void rollbackPreservaImagem() {
        var store = new ImagemProdutoStore(directory.toString(), null);
        UUID id = UUID.randomUUID();
        String url = store.criar(id, Categoria.PIZZAS);
        TransactionSynchronizationManager.initSynchronization();
        try { store.apagarAposCommit(url); }
        finally { TransactionSynchronizationManager.clearSynchronization(); }
        assertTrue(Files.exists(directory.resolve(id + ".svg")));
    }
}
