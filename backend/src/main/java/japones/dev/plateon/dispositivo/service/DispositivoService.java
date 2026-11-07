package japones.dev.plateon.dispositivo.service;


import japones.dev.plateon.compartilhado.*;
import japones.dev.plateon.seguranca.SecurityConfig;
import jakarta.validation.constraints.NotBlank;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DispositivoService {
    private static final char[] ALFABETO="ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private final Sql db; private final Clock clock; private final SecureRandom random=new SecureRandom();
    private final ConcurrentHashMap<String,String> pendentes=new ConcurrentHashMap<>();
    public DispositivoService(Sql db,Clock clock) { this.db=db; this.clock=clock; }
    public record Solicitacao(String solicitacaoId,String codigo,Instant expiraEm) {}
    public record EstadoPareamento(String status,String token) {}
    public record Aprovar(@NotBlank String codigo,@NotBlank String mesaId) {}
    public record DispositivoView(String id,String mesaId,int numeroMesa,String nome,boolean ativo,Instant pareadoEm,Instant ultimoAcessoEm,boolean online) {}
    public record DispositivoInput(String nome,String mesaId) {}
    public Solicitacao solicitar() {
        var now=clock.instant(); String id=db.id(); String code=null;
        for(int attempt=0;attempt<10;attempt++) {
            var builder=new StringBuilder(); for(int i=0;i<6;i++) builder.append(ALFABETO[random.nextInt(ALFABETO.length)]);
            String candidate=builder.toString();
            if(db.optional("SELECT id FROM solicitacao_pareamento WHERE codigo=?",candidate)==null) { code=candidate; break; }
        }
        if(code==null) throw new ApiException(HttpStatus.CONFLICT,"Não foi possível criar código único");
        db.jdbc().update("INSERT INTO solicitacao_pareamento(id,codigo,status,criada_em,expira_em) VALUES(?,?,'PENDENTE',?,?)",id,code,db.ts(now),db.ts(now.plusSeconds(600)));
        return new Solicitacao(id,code,now.plusSeconds(600));
    }
    @Transactional public EstadoPareamento consultar(String id) {
        var row=db.one("SELECT * FROM solicitacao_pareamento WHERE id=? FOR UPDATE",id);
        String status=db.str(row,"status");
        if(status.equals("PENDENTE") && db.instant(row,"expira_em").isBefore(clock.instant())) {
            db.jdbc().update("UPDATE solicitacao_pareamento SET status='EXPIRADA' WHERE id=?",id);
            status="EXPIRADA";
        }
        if(status.equals("EXPIRADA")) throw new ApiException(HttpStatus.GONE,"Código expirado");
        if(status.equals("CONSUMIDA")) throw new ApiException(HttpStatus.GONE,"Token já entregue");
        if(status.equals("APROVADA")) {
            String token=pendentes.get(id);
            if(token==null) throw new ApiException(HttpStatus.GONE,"Token de pareamento indisponível; solicite novo pareamento");
            db.jdbc().update("UPDATE solicitacao_pareamento SET status='CONSUMIDA' WHERE id=?",id);
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override public void afterCommit() { pendentes.remove(id); }
                });
            return new EstadoPareamento("CONSUMIDA",token);
        }
        return new EstadoPareamento(status,null);
    }
    @Transactional public DispositivoView aprovar(Aprovar input) {
        var row=db.optional("SELECT * FROM solicitacao_pareamento WHERE codigo=? FOR UPDATE",input.codigo());
        if(row==null || !db.str(row,"status").equals("PENDENTE") || db.instant(row,"expira_em").isBefore(clock.instant()))
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,"Código inválido, usado ou expirado");
        var mesa=db.one("SELECT * FROM mesa WHERE id=? AND ativa=1",input.mesaId());
        Validar.exigir(db.optional("SELECT id FROM dispositivo WHERE mesa_id=? AND ativo=1",input.mesaId())==null,HttpStatus.CONFLICT,"Mesa já possui tablet ativo");
        byte[] bytes=new byte[32]; random.nextBytes(bytes); String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String id=db.id(); var now=clock.instant();
        db.jdbc().update("INSERT INTO dispositivo(id,mesa_id,nome,token_hash,ativo,pareado_em) VALUES(?,?,?,?,1,?)",
            id,input.mesaId(),"Tablet mesa "+mesa.get("numero"),SecurityConfig.hash(token),db.ts(now));
        db.jdbc().update("UPDATE solicitacao_pareamento SET status='APROVADA',dispositivo_id=? WHERE id=?",id,row.get("id"));
        String solicitacaoId=db.str(row,"id");
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
            new org.springframework.transaction.support.TransactionSynchronization() {
                @Override public void afterCommit() { pendentes.put(solicitacaoId,token); }
            });
        return view(db.one("SELECT d.*,m.numero FROM dispositivo d JOIN mesa m ON m.id=d.mesa_id WHERE d.id=?",id));
    }
    public List<DispositivoView> listar() { return db.jdbc().queryForList("SELECT d.*,m.numero FROM dispositivo d JOIN mesa m ON m.id=d.mesa_id ORDER BY m.numero").stream().map(this::view).toList(); }
    public DispositivoView atualizar(String id,DispositivoInput input) {
        var row=db.one("SELECT * FROM dispositivo WHERE id=?",id);
        String mesa=input.mesaId()==null ? db.str(row,"mesa_id") : input.mesaId();
        db.one("SELECT id FROM mesa WHERE id=? AND ativa=1",mesa);
        String nome=input.nome()==null ? db.str(row,"nome") : input.nome();
        db.jdbc().update("UPDATE dispositivo SET mesa_id=?,nome=? WHERE id=?",mesa,nome,id);
        return view(db.one("SELECT d.*,m.numero FROM dispositivo d JOIN mesa m ON m.id=d.mesa_id WHERE d.id=?",id));
    }
    public void revogar(String id) {
        if(db.jdbc().update("UPDATE dispositivo SET ativo=0,revogado_em=? WHERE id=? AND ativo=1",db.ts(clock.instant()),id)==0)
            throw new ApiException(HttpStatus.NOT_FOUND,"Tablet ativo não encontrado");
    }
    private DispositivoView view(Map<String,Object> r) {
        var last=db.instant(r,"ultimo_acesso_em");
        return new DispositivoView(db.str(r,"id"),db.str(r,"mesa_id"),((Number)r.get("numero")).intValue(),
            db.str(r,"nome"),Boolean.TRUE.equals(r.get("ativo")),db.instant(r,"pareado_em"),last,
            Boolean.TRUE.equals(r.get("ativo")) && last!=null && last.isAfter(clock.instant().minusSeconds(120)));
    }
    @Scheduled(fixedDelay=300000) public void expirar() {
        db.jdbc().update("UPDATE solicitacao_pareamento SET status='EXPIRADA' WHERE status='PENDENTE' AND expira_em < ?",db.ts(clock.instant()));
        db.jdbc().update("DELETE FROM solicitacao_pareamento WHERE status='EXPIRADA' AND expira_em < ?",db.ts(clock.instant().minus(Duration.ofDays(1))));
    }
}
