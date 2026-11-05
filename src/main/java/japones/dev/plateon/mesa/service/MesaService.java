package japones.dev.plateon.mesa.service;


import japones.dev.plateon.compartilhado.ApiException;
import japones.dev.plateon.mesa.domain.Mesa;
import japones.dev.plateon.mesa.repository.MesaRepository;
import jakarta.validation.constraints.Min;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MesaService {
    private final MesaRepository repository;
    public MesaService(MesaRepository repository) { this.repository=repository; }
    public record MesaInput(@Min(1) int numero,@Min(1) int capacidade,boolean ativa) {}
    public record MesaView(String id,int numero,int capacidade,boolean ativa) {}
    public List<MesaView> listar() { return repository.findAll().stream().map(this::view).sorted(Comparator.comparingInt(MesaView::numero)).toList(); }
    public MesaView ver(String id) { return view(obter(id)); }
    @Transactional public MesaView criar(MesaInput input) {
        var mesa=new Mesa(null); preencher(mesa,input); return view(repository.saveAndFlush(mesa));
    }
    @Transactional public MesaView atualizar(String id,MesaInput input) {
        var mesa=obter(id); preencher(mesa,input); return view(repository.saveAndFlush(mesa));
    }
    @Transactional public void excluir(String id) { var mesa=obter(id); mesa.setAtiva(false); repository.saveAndFlush(mesa); }
    private Mesa obter(String id) {
        try { return repository.findById(UUID.fromString(id)).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"Mesa não encontrada")); }
        catch(IllegalArgumentException ex) { throw new ApiException(HttpStatus.NOT_FOUND,"Mesa não encontrada"); }
    }
    private void preencher(Mesa mesa,MesaInput input) { mesa.setNumero(input.numero());mesa.setCapacidade(input.capacidade());mesa.setAtiva(input.ativa()); }
    private MesaView view(Mesa mesa) { return new MesaView(mesa.getId().toString(),mesa.getNumero(),mesa.getCapacidade(),mesa.getAtiva()); }
}
