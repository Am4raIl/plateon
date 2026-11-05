package japones.dev.plateon.mesa.service;


import japones.dev.plateon.compartilhado.*;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class ChamadoService {
    private final Sql db; private final Clock clock;
    public ChamadoService(Sql db,Clock clock) { this.db=db;this.clock=clock; }
    public record Atendimento(String status) {}
    public record ChamadoAdminView(String id,String tipo,String status,Instant criadoEm,Instant atendidoEm,int numeroMesa) {}
    public Pagina<ChamadoAdminView> listar(int pagina,int tamanho,String status) {
        int offset=Pagina.offset(pagina,tamanho);
        String filtro=status==null || status.isBlank() ? null : status.toUpperCase(Locale.ROOT);
        Validar.exigir(filtro==null || Set.of("ABERTO","ATENDIDO").contains(filtro),HttpStatus.BAD_REQUEST,"Status de chamado inválido");
        String where=filtro==null ? "" : " WHERE c.status=?";
        Long total=filtro==null ? db.jdbc().queryForObject("SELECT COUNT(*) FROM chamado_garcom c",Long.class)
            : db.jdbc().queryForObject("SELECT COUNT(*) FROM chamado_garcom c"+where,Long.class,filtro);
        String sql="SELECT c.id,c.tipo,c.status,c.criado_em,c.atendido_em,m.numero AS numero_mesa FROM chamado_garcom c JOIN mesa m ON m.id=c.mesa_id"
            +where+" ORDER BY c.criado_em DESC,c.id DESC LIMIT ? OFFSET ?";
        var rows=filtro==null ? db.jdbc().queryForList(sql,tamanho,offset) : db.jdbc().queryForList(sql,filtro,tamanho,offset);
        return Pagina.criar(rows.stream().map(this::view).toList(),pagina,tamanho,total);
    }
    public ChamadoAdminView atender(String id,Atendimento input) {
        Validar.exigir("ATENDIDO".equals(input.status()),HttpStatus.UNPROCESSABLE_ENTITY,"Status inválido");
        if(db.jdbc().update("UPDATE chamado_garcom SET status='ATENDIDO',atendido_em=?,atendido_por=? WHERE id=? AND status='ABERTO'",
            db.ts(clock.instant()),SecurityContextHolder.getContext().getAuthentication().getName(),id)==0)
            throw new ApiException(HttpStatus.CONFLICT,"Chamado já atendido ou inexistente");
        return view(db.one("SELECT c.id,c.tipo,c.status,c.criado_em,c.atendido_em,m.numero AS numero_mesa FROM chamado_garcom c JOIN mesa m ON m.id=c.mesa_id WHERE c.id=?",id));
    }
    private ChamadoAdminView view(Map<String,Object> r) {
        return new ChamadoAdminView(db.str(r,"id"),db.str(r,"tipo"),db.str(r,"status"),db.instant(r,"criado_em"),db.instant(r,"atendido_em"),
            ((Number)r.get("numero_mesa")).intValue());
    }
}
