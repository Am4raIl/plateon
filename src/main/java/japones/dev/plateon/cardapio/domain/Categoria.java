package japones.dev.plateon.cardapio.domain;


public enum Categoria {
    ENTRADAS, PORCOES, HAMBURGUERES, MASSAS, PIZZAS, PRATOS_PRINCIPAIS, BEBIDAS, SOBREMESAS;
    public boolean aceitaAdicionais() { return this != PRATOS_PRINCIPAIS && this != BEBIDAS; }
}
