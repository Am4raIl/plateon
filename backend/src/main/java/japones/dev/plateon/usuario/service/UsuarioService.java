package japones.dev.plateon.usuario.service;


import japones.dev.plateon.compartilhado.*;
import japones.dev.plateon.usuario.domain.*;
import japones.dev.plateon.usuario.repository.UsuarioRepository;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

@Service
public class UsuarioService {
    private final UsuarioRepository repository; private final PasswordEncoder passwords;
    public UsuarioService(UsuarioRepository repository,PasswordEncoder passwords) { this.repository=repository;this.passwords=passwords; }
    public record UsuarioInput(@NotBlank @Size(max=120) String nome,@NotBlank @Size(max=80) String username,@Size(min=8) String senha,@NotBlank String papel,boolean ativo) {}
    public record UsuarioView(String id,String nome,String username,String papel,boolean ativo) {}
    @Transactional(readOnly=true) public Pagina<UsuarioView> listar(int pagina,int tamanho) {
        Pagina.validar(pagina,tamanho);
        var resultado=repository.findAll(PageRequest.of(pagina,tamanho,Sort.by("nome").ascending().and(Sort.by("id").ascending())));
        return Pagina.criar(resultado.getContent().stream().map(this::view).toList(),pagina,tamanho,resultado.getTotalElements());
    }
    public UsuarioView ver(String id) { return view(obter(id)); }
    @Transactional public UsuarioView criar(UsuarioInput input) {
        Validar.exigir(input.senha()!=null && input.senha().length()>=8,HttpStatus.BAD_REQUEST,"Senha deve ter pelo menos 8 caracteres");
        var usuario=new Usuario(null); preencher(usuario,input,true); return view(repository.saveAndFlush(usuario));
    }
    @Transactional public UsuarioView atualizar(String id,UsuarioInput input) {
        var usuario=obter(id); preencher(usuario,input,false); return view(repository.saveAndFlush(usuario));
    }
    @Transactional public void excluir(String id) { var usuario=obter(id);usuario.setAtivo(false);repository.saveAndFlush(usuario); }
    private Usuario obter(String id) {
        try { return repository.findById(UUID.fromString(id)).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"Usuário não encontrado")); }
        catch(IllegalArgumentException ex) { throw new ApiException(HttpStatus.NOT_FOUND,"Usuário não encontrado"); }
    }
    private void preencher(Usuario u,UsuarioInput input,boolean novo) {
        Validar.exigir(Set.of("COZINHA","GARCOM","GERENTE").contains(input.papel()),HttpStatus.UNPROCESSABLE_ENTITY,"Papel inválido");
        u.setNome(input.nome());u.setUsername(input.username());u.setPapel(Papel.valueOf(input.papel()));u.setAtivo(input.ativo());
        if(novo || input.senha()!=null && !input.senha().isBlank()) {
            Validar.exigir(input.senha()!=null && input.senha().length()>=8,HttpStatus.BAD_REQUEST,"Senha deve ter pelo menos 8 caracteres");
            u.setSenhaHash(passwords.encode(input.senha()));
        }
    }
    private UsuarioView view(Usuario u) { return new UsuarioView(u.getId().toString(),u.getNome(),u.getUsername(),u.getPapel().name(),u.getAtivo()); }
}
