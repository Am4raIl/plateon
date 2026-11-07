package japones.dev.plateon.compartilhado;

import java.util.List;
import org.springframework.http.HttpStatus;

public record Pagina<T>(List<T> itens,int pagina,int tamanho,long totalItens,int totalPaginas,boolean temProxima) {
    public static void validar(int pagina,int tamanho) {
        Validar.exigir(pagina>=0 && pagina<=1_000_000,HttpStatus.BAD_REQUEST,"pagina deve estar entre 0 e 1000000");
        Validar.exigir(tamanho>=1 && tamanho<=100,HttpStatus.BAD_REQUEST,"tamanho deve estar entre 1 e 100");
    }
    public static int offset(int pagina,int tamanho) { validar(pagina,tamanho); return pagina*tamanho; }
    public static <T> Pagina<T> criar(List<T> itens,int pagina,int tamanho,long total) {
        validar(pagina,tamanho);
        int paginas=(int)Math.min(Integer.MAX_VALUE,(total+tamanho-1)/tamanho);
        return new Pagina<>(itens,pagina,tamanho,total,paginas,(long)(pagina+1)*tamanho<total);
    }
}
