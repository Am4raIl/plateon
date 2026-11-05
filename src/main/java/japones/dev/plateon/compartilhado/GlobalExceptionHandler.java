package japones.dev.plateon.compartilhado;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class);
    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> api(ApiException ex) {
        var problem = ProblemDetail.forStatusAndDetail(ex.status(), ex.getMessage());
        ex.details().forEach(problem::setProperty);
        return ResponseEntity.status(ex.status()).body(problem);
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> validation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage).collect(Collectors.joining("; "));
        return problem(HttpStatus.BAD_REQUEST, message);
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> body(HttpMessageNotReadableException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Corpo da requisição inválido ou contém campos desconhecidos");
    }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ProblemDetail> integrity(DataAccessException ex) {
        String cause=ex.getMostSpecificCause().getMessage();
        if(cause!=null && cause.contains("ck_ac_categoria"))
            return problem(HttpStatus.UNPROCESSABLE_ENTITY,"Categoria não aceita adicionais");
        if(cause!=null && cause.contains("ck_item_quantidade"))
            return problem(HttpStatus.UNPROCESSABLE_ENTITY,"Quantidade deve ser pelo menos 1");
        if(cause!=null && (cause.contains("ck_produto_preco") || cause.contains("ck_adicional_preco") || cause.contains("ck_pag_valor")))
            return problem(HttpStatus.UNPROCESSABLE_ENTITY,"Valor fora do intervalo permitido");
        if(cause!=null && cause.contains("ux_dispositivo_ativo_por_mesa"))
            return problem(HttpStatus.CONFLICT,"Mesa já possui tablet ativo");
        if(cause!=null && cause.contains("ux_comanda_aberta_por_mesa"))
            return problem(HttpStatus.CONFLICT,"Mesa já possui comanda aberta");
        if(cause!=null && cause.contains("ux_pedido_rascunho_por_comanda"))
            return problem(HttpStatus.CONFLICT,"Comanda já possui rascunho");
        if(ex instanceof DataIntegrityViolationException)
            return problem(HttpStatus.CONFLICT,"Registro duplicado ou restrição do banco violada");
        log.error("Erro de acesso ao banco",ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR,"Erro interno");
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> unexpected(Exception ex) {
        log.error("Erro não tratado na API",ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno");
    }
    private ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
        return ResponseEntity.status(status).body(ProblemDetail.forStatusAndDetail(status, detail));
    }
}
