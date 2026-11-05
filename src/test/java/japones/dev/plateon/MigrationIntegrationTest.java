package japones.dev.plateon;

import japones.dev.plateon.compartilhado.Sql;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessException;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.mysql.MySQLContainer;
import java.time.Instant;
import java.sql.Timestamp;
import static org.junit.jupiter.api.Assertions.*;

class MigrationIntegrationTest {
    @Test void migrationsEConstraintsEmMySqlVazio() {
        String external=System.getenv("PLATEON_MIGRATION_TEST_JDBC");
        MySQLContainer mysql=null;
        if(external==null) {
            Assumptions.assumeTrue(DockerClientFactory.instance().isDockerAvailable(),"Docker indisponível");
            mysql=new MySQLContainer("mysql:8.4"); mysql.start(); external=mysql.getJdbcUrl();
        }
        String username=mysql==null ? "plateon" : mysql.getUsername();
        String password=mysql==null ? "plateon" : mysql.getPassword();
        try {
            try(var context=new SpringApplicationBuilder(PlateonApplication.class)
                    .run("--spring.datasource.url="+TestMysqlUrl.utc(external),
                        "--spring.datasource.username="+username,
                        "--spring.datasource.password="+password,
                        "--restaurante.jwt.segredo=integration_test_secret_32_characters_long",
                        "--restaurante.seed.referencia=false","--server.port=0")) {
                var db=context.getBean(Sql.class);
                assertEquals(8,db.jdbc().queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success=1",Integer.class));
                String mesa=db.id(),mesa2=db.id();
                db.jdbc().update("INSERT INTO mesa(id,numero,capacidade,ativa) VALUES(?,1,4,1)",mesa);
                assertThrows(DataIntegrityViolationException.class,() -> db.jdbc().update("INSERT INTO mesa(id,numero,capacidade,ativa) VALUES(?,1,4,1)",mesa2));
                String adicional=db.id();
                db.jdbc().update("INSERT INTO adicional(id,nome,preco,ativo) VALUES(?,'Teste',1,1)",adicional);
                assertThrows(DataAccessException.class,() -> db.jdbc().update("INSERT INTO adicional_categoria(adicional_id,categoria) VALUES(?,'BEBIDAS')",adicional));
                String dispositivo1=db.id();
                db.jdbc().update("INSERT INTO dispositivo(id,mesa_id,nome,token_hash,ativo,pareado_em) VALUES(?,?,?, ?,1,?)",
                    dispositivo1,mesa,"T1","a".repeat(64),Timestamp.from(Instant.now()));
                assertThrows(DataIntegrityViolationException.class,() -> db.jdbc().update("INSERT INTO dispositivo(id,mesa_id,nome,token_hash,ativo,pareado_em) VALUES(?,?,?, ?,1,?)",
                    db.id(),mesa,"T2","b".repeat(64),Timestamp.from(Instant.now())));
                String comanda=db.id();
                db.jdbc().update("INSERT INTO comanda(id,mesa_id,status,aberta_em,taxa_servico_percentual,couvert) VALUES(?,?,'ABERTA',?,10,0)",comanda,mesa,Timestamp.from(Instant.now()));
                assertThrows(DataIntegrityViolationException.class,() -> db.jdbc().update("INSERT INTO comanda(id,mesa_id,status,aberta_em,taxa_servico_percentual,couvert) VALUES(?,?,'ABERTA',?,10,0)",db.id(),mesa,Timestamp.from(Instant.now())));
                var now=Timestamp.from(Instant.now());
                db.jdbc().update("INSERT INTO pedido(id,comanda_id,status,criado_em,atualizado_em) VALUES(?,?,'RASCUNHO',?,?)",db.id(),comanda,now,now);
                assertThrows(DataIntegrityViolationException.class,() -> db.jdbc().update("INSERT INTO pedido(id,comanda_id,status,criado_em,atualizado_em) VALUES(?,?,'RASCUNHO',?,?)",db.id(),comanda,now,now));
            }
        } finally { if(mysql!=null) mysql.stop(); }
    }
}
