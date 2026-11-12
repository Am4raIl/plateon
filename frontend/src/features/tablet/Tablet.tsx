import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useNavigate,
  useOutletContext,
  useParams,
  useLocation,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError, publicApi, tabletApi } from "../../api/client";
import { useAction, useRead } from "../../api/hooks";
import {
  categorias,
  estadoPareamentoSchema,
  solicitacaoSchema,
  type ChamadoView,
  type ComandaView,
  type EstadoMesa,
  type ItemInput,
  type ItemPedido,
  type PedidoView,
  type ProdutoView,
  type SolicitacaoPareamento,
} from "../../api/types";
import { useNotices, useSession } from "../../app/store";
import {
  Banner,
  Brand,
  Button,
  Empty,
  ErrorState,
  Field,
  Input,
  LinkButton,
  Modal,
  Photo,
  Skeleton,
  Stepper,
  Tag,
  controlClass,
} from "../../design/ui";
import { labels, mesa, moeda } from "../../lib/format";
import { connectSse, type Connection } from "../../lib/sse";
import layout from "../../app/layouts.module.css";
import s from "./tablet.module.css";
import { ThemeToggle } from "../../design/theme";
type TabletContext = {
  state: EstadoMesa | null | undefined;
  bill: ComandaView | null | undefined;
  draft: PedidoView | undefined;
  locked: boolean;
  refresh: () => void;
};
const useTablet = () => useOutletContext<TabletContext>();
export function TabletLayout() {
  const token = useSession((s) => s.tablet);
  const state = useRead<EstadoMesa>("tablet", "/mesa/estado", 2000, !!token);
  const bill = useRead<ComandaView>("tablet", "/mesa/comanda", 10000, !!token);
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [calling, setCalling] = useState(false);
  const [orderConnection, setOrderConnection] =
    useState<Connection>("conectado");
  const previous = useRef<string | null>(null);
  const previousMesa = useRef<number | undefined>(undefined);
  const refresh = () => {
    void state.refetch();
    void bill.refetch();
  };
  useEffect(() => {
    if (!state.data) return;
    if (
      previousMesa.current !== undefined &&
      previousMesa.current !== state.data.numeroMesa
    ) {
      client.removeQueries({ queryKey: ["tablet"] });
      navigate("/mesa/boas-vindas", { replace: true });
    }
    previousMesa.current = state.data.numeroMesa;
    if (
      previous.current &&
      previous.current !== "LIVRE" &&
      state.data.estado === "LIVRE"
    ) {
      client.removeQueries({ queryKey: ["tablet", "/mesa/comanda"] });
      navigate("/mesa/encerramento", { replace: true });
    }
    previous.current = state.data.estado;
  }, [state.data, client, navigate]);
  const ids =
    bill.data?.pedidos
      .filter(
        (p) =>
          p.status !== "RASCUNHO" &&
          !["ENTREGUE", "CANCELADO"].includes(p.status),
      )
      .map((p) => p.id)
      .sort()
      .join(",") ?? "";
  useEffect(() => {
    if (!token || !ids) return;
    const states: Record<string, Connection> = {};
    const close = ids.split(",").map((id) =>
      connectSse(
        "tablet",
        `/mesa/pedidos/${id}/eventos`,
        () => client.invalidateQueries({ queryKey: ["tablet"] }),
        (status) => {
          states[id] = status;
          setOrderConnection(
            Object.values(states).every((s) => s === "conectado")
              ? "conectado"
              : "reconectando",
          );
        },
      ),
    );
    return () => close.forEach((fn) => fn());
  }, [ids, token, client]);
  useEffect(() => {
    if (token) return;
    client.removeQueries({ queryKey: ["tablet"] });
  }, [token, client]);
  if (!token) return <Navigate to="/mesa/pareamento" replace />;
  const draft = bill.data?.pedidos.find((p) => p.status === "RASCUNHO");
  const locked = state.data?.estado === "AGUARDANDO_PAGAMENTO";
  const count = draft?.itens.reduce((n, i) => n + i.quantidade, 0) ?? 0;
  return (
    <>
      <header className={layout.top}>
        <Brand />
        <span className={layout.tableName}>
          {state.data ? mesa(state.data.numeroMesa) : "Sua mesa"}
        </span>
        <nav aria-label="Navegação da mesa">
          <NavLink to="/mesa/cardapio">Cardápio</NavLink>
          <NavLink to="/mesa/rascunho">
            Rascunho{" "}
            <span key={count} className={`count ${s.draftBadge}`}>
              {count}
            </span>
          </NavLink>
          <NavLink to="/mesa/comanda">
            Comanda{" "}
            <span className="count">
              {bill.data?.pedidos.filter(
                (p) => !["RASCUNHO", "CANCELADO"].includes(p.status),
              ).length ?? 0}
            </span>
          </NavLink>
        </nav>
        <Button variant="secondary" onClick={() => setCalling(true)}>
          Chamar garçom
        </Button>
        <ThemeToggle compact />
      </header>
      <main id="conteudo" data-area="tablet">
        {state.isError ? (
          <ErrorState error={state.error} retry={() => state.refetch()} />
        ) : state.isPending || bill.isPending ? (
          <div className="page">
            <Skeleton />
          </div>
        ) : (
          <>
            {ids && orderConnection !== "conectado" && (
              <Banner kind="warn">
                Estamos reconectando seus pedidos. A comanda continua sendo
                atualizada; aguarde para acompanhar as próximas etapas.
              </Banner>
            )}
            {bill.isError && (
              <Banner kind="error">
                Não conseguimos atualizar sua comanda.{" "}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bill.refetch()}
                >
                  Tentar de novo
                </Button>
              </Banner>
            )}
            {locked && (
              <Banner kind="warn">
                Sua conta está em fechamento. Novos pedidos estão pausados. Você
                pode acompanhar seus pedidos ou chamar o garçom.
              </Banner>
            )}
            <Outlet
              context={
                {
                  state: state.data,
                  bill: bill.data,
                  draft,
                  locked,
                  refresh,
                } satisfies TabletContext
              }
            />
          </>
        )}
      </main>
      {calling && <CallSheet onClose={() => setCalling(false)} />}
      <span className="sr-only" aria-live="polite">
        {location.pathname.includes("encerramento")
          ? "Conta paga. Obrigado pela visita."
          : ""}
      </span>
    </>
  );
}
export function Pairing() {
  const token = useSession((s) => s.tablet);
  const setToken = useSession((s) => s.setTablet);
  const navigate = useNavigate();
  const [request, setRequest] = useState<SolicitacaoPareamento | null>(null);
  const [expired, setExpired] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const initial = useRef<Promise<SolicitacaoPareamento> | undefined>(undefined);
  const create = useAction(
    async () =>
      solicitacaoSchema.parse(
        await publicApi("/dispositivos/pareamento", "POST"),
      ),
    {
      quiet: true,
      success: (data) => {
        setExpired(false);
        setRequest(data);
      },
    },
  );
  const generate = create.mutateAsync;
  useEffect(() => {
    if (token) return;
    initial.current ??= generate();
    void initial.current.catch(() => {});
  }, [token, generate]);
  const [pollError, setPollError] = useState<ApiError | null>(null);
  useEffect(() => {
    if (!request || expired || token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = setInterval(() => {
      const left = Math.ceil(
        (Date.parse(request.expiraEm) - Date.now()) / 1000,
      );
      setSeconds(Math.max(0, left));
      if (left <= 0) setExpired(true);
    }, 500);
    const poll = async () => {
      try {
        const data = estadoPareamentoSchema.parse(
          await publicApi(`/dispositivos/pareamento/${request.solicitacaoId}`),
        );
        if (stopped) return;
        setPollError(null);
        if (data.status === "CONSUMIDA" && data.token) {
          setToken(data.token);
          navigate("/mesa/boas-vindas", { replace: true });
          return;
        }
        timer = setTimeout(poll, 3000);
      } catch (e) {
        if (stopped) return;
        const error = e instanceof ApiError ? e : new ApiError(0);
        setPollError(error);
        if (error.status === 410) {
          setExpired(true);
          return;
        }
        timer = setTimeout(
          poll,
          error.status === 429 ? error.retryAfter * 1000 : 5000,
        );
      }
    };
    timer = setTimeout(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(tick);
      clearTimeout(timer);
    };
  }, [request, expired, token, setToken, navigate]);
  if (token) return <Navigate to="/mesa/boas-vindas" replace />;
  return (
    <main id="conteudo" className="blank">
      <div className={s.pairing}>
        <Brand />
        <ThemeToggle />
        <div className="section-label">Bem-vindo à casa</div>
        <h1>{expired ? "Este código venceu" : "Vamos preparar sua mesa"}</h1>
        <p>Peça a um garçom ou ao gerente para aprovar este código</p>
        {request ? (
          <>
            <div
              className={`${s.code} ${expired ? s.expired : ""}`}
              aria-label="Código de pareamento"
            >
              {request.codigo.slice(0, 3)} {request.codigo.slice(3)}
            </div>
            {expired ? (
              <Banner kind="warn">
                O código venceu. Gere um novo para continuar.
              </Banner>
            ) : (
              <p role="status">
                ● Aguardando aprovação · válido por {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </p>
            )}
          </>
        ) : (
          <Empty
            title="Preparando seu código"
            text="Aguarde um momento ou tente de novo."
          />
        )}
        {(expired || !request) && (
          <Button
            size="lg"
            loading={create.isPending}
            disabled={create.busy}
            onClick={() => create.mutate()}
          >
            {expired ? "Gerar novo código" : "Tentar de novo"}
            {create.remaining ? ` · ${create.remaining} s` : ""}
          </Button>
        )}
        {(pollError || create.error) && (
          <Banner kind="error">{(pollError ?? create.error)?.message}</Banner>
        )}
        <footer>
          <Link to="/equipe/login">Acesso da equipe</Link>
        </footer>
      </div>
    </main>
  );
}
export function Welcome() {
  const { state } = useTablet();
  return (
    <section className={s.welcome}>
      <div className="section-label">É um prazer receber você</div>
      <h1>{mesa(state!.numeroMesa)}</h1>
      <p>
        Escolha com calma. A boa companhia e os sabores da casa fazem o resto.
      </p>
      <div className="actions">
        <LinkButton to="/mesa/cardapio" size="lg">
          Ver o cardápio →
        </LinkButton>
      </div>
      <small className="muted">Se precisar de algo, estamos por perto.</small>
    </section>
  );
}
export function Menu() {
  const menu = useRead<ProdutoView[]>("tablet", "/mesa/cardapio");
  const { draft, locked } = useTablet();
  const [category, setCategory] =
    useState<(typeof categorias)[number]>("ENTRADAS");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  if (menu.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (menu.isError)
    return <ErrorState error={menu.error} retry={() => menu.refetch()} />;
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const items = (menu.data ?? []).filter((p) =>
    term
      ? `${p.nome} ${p.descricao ?? ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(term)
      : p.categoria === category,
  );
  const choose = (p: ProdutoView) => navigate(`/mesa/produto/${p.id}`);
  const [hero, ...rest] = items;
  return (
    <div className={s.menu}>
      <aside className={s.categories}>
        <small>À sua escolha</small>
        {categorias.map((c, i) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {labels[c]}
          </button>
        ))}
      </aside>
      <div className={s.menuContent}>
        <header className={s.menuHead}>
          <div>
            <div className="section-label">
              {term
                ? "Todo o cardápio"
                : `${String(categorias.indexOf(category) + 1).padStart(2, "0")} ${labels[category]}`}
            </div>
            <h1>{term ? "Resultados da busca" : labels[category]}</h1>
          </div>
          <Input
            label="Buscar no cardápio"
            type="search"
            placeholder="O que você procura?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </header>
        {!hero ? (
          <Empty
            title="Nenhum prato por aqui"
            text={
              search
                ? "Tente outro nome ou descrição."
                : "Escolha outra categoria do cardápio."
            }
            action={
              search ? (
                <Button variant="secondary" onClick={() => setSearch("")}>
                  Limpar busca
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <article className={s.hero}>
              <Photo
                url={hero.imagemUrl}
                name={hero.nome}
                className={`${s.heroPhoto} ${!hero.disponivel ? s.soldOut : ""}`}
              />
              <div>
                <h2>{hero.nome}</h2>
                {hero.descricao && (
                  <p className={s.ingredients}>{hero.descricao}</p>
                )}
                <strong>{moeda(hero.preco)}</strong>
                {hero.disponivel ? (
                  <Button
                    size="lg"
                    disabled={locked}
                    onClick={() => choose(hero)}
                  >
                    Escolher →
                  </Button>
                ) : (
                  <Tag status="ESGOTADO">Esgotado agora</Tag>
                )}
              </div>
            </article>
            {rest.map((p) => (
              <article
                key={p.id}
                className={`${s.productRow} ${!p.disponivel ? s.unavailable : ""}`}
              >
                <Photo
                  url={p.imagemUrl}
                  name={p.nome}
                  className={`${s.productRowPhoto} ${!p.disponivel ? s.soldOut : ""}`}
                />
                <div>
                  <h2>{p.nome}</h2>
                  {p.descricao && (
                    <p className={s.ingredients}>{p.descricao}</p>
                  )}
                </div>
                <div>
                  <strong>{moeda(p.preco)}</strong>
                  {p.disponivel ? (
                    <Button
                      variant="secondary"
                      disabled={locked}
                      onClick={() => choose(p)}
                    >
                      Adicionar
                    </Button>
                  ) : (
                    <Tag status="ESGOTADO">Esgotado agora</Tag>
                  )}
                </div>
              </article>
            ))}
          </>
        )}
      </div>
      {draft && draft.itens.length > 0 && (
        <div className={s.floating}>
          <div>
            <div className="row">
              <Tag status="RASCUNHO" />
              <strong>
                {draft.itens.reduce((n, i) => n + i.quantidade, 0)} itens ·{" "}
                {moeda(draft.subtotal)}
              </strong>
            </div>
            <p>Ainda não enviado à cozinha.</p>
          </div>
          <Button onClick={() => navigate("/mesa/rascunho")}>
            Revisar e enviar →
          </Button>
        </div>
      )}
    </div>
  );
}
export function Product() {
  const { id } = useParams();
  const menu = useRead<ProdutoView[]>("tablet", "/mesa/cardapio");
  const { draft, locked } = useTablet();
  const [quantity, setQuantity] = useState(1);
  const [extras, setExtras] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const navigate = useNavigate();
  const notify = useNotices((s) => s.add);
  const add = useAction(
    async () => {
      const d = draft ?? (await tabletApi<PedidoView>("/mesa/pedidos", "POST"));
      return tabletApi<PedidoView>(`/mesa/pedidos/${d.id}/itens`, "POST", {
        produtoId: id,
        quantidade: quantity,
        observacao: note,
        adicionaisIds: extras,
      });
    },
    {
      success: () => {
        notify("Rascunho atualizado.");
        navigate("/mesa/rascunho");
      },
    },
  );
  if (menu.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (menu.isError)
    return <ErrorState error={menu.error} retry={() => menu.refetch()} />;
  const product = menu.data?.find((p) => p.id === id);
  if (!product)
    return (
      <Empty
        title="Este prato não está mais no cardápio"
        text="Escolha outro prato para continuar."
        action={<Link to="/mesa/cardapio">Voltar ao cardápio</Link>}
      />
    );
  const preview =
    (product.preco +
      product.adicionaisDisponiveis
        .filter((a) => extras.includes(a.id))
        .reduce((s, a) => s + a.preco, 0)) *
    quantity;
  return (
    <section className={s.product}>
      <div className="stack">
        <Link to="/mesa/cardapio">← Voltar ao cardápio</Link>
        <Photo
          url={product.imagemUrl}
          name={product.nome}
          className={s.productPhoto}
        />
        <p>Feito com cuidado, servido na sua mesa.</p>
      </div>
      <div className="stack">
        <div>
          <div className="section-label">{labels[product.categoria]}</div>
          <h1>{product.nome}</h1>
          {product.descricao && (
            <p className={s.ingredients}>{product.descricao}</p>
          )}
        </div>
        <strong>{moeda(product.preco)}</strong>
        {product.adicionaisDisponiveis.length > 0 && (
          <fieldset className={s.extras}>
            <legend>Do seu jeito · adicionais opcionais</legend>
            {product.adicionaisDisponiveis.map((a) => (
              <label key={a.id}>
                <input
                  type="checkbox"
                  checked={extras.includes(a.id)}
                  onChange={(e) =>
                    setExtras(
                      e.target.checked
                        ? [...extras, a.id]
                        : extras.filter((id) => id !== a.id),
                    )
                  }
                />
                <span>{a.nome}</span>
                <span>+ {moeda(a.preco)}</span>
              </label>
            ))}
          </fieldset>
        )}
        <Field label="Quantidade">
          <Stepper
            value={quantity}
            onChange={setQuantity}
            disabled={locked || add.busy}
          />
        </Field>
        <label className="stack-sm">
          Observação
          <textarea
            className={controlClass}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Algum cuidado especial com seu prato?"
          />
          <small className="muted">{note.length}/200 caracteres</small>
        </label>
        {!product.disponivel && (
          <Banner kind="warn">
            Este prato esgotou agora. Volte ao cardápio e escolha outro.
          </Banner>
        )}
        {add.error && (
          <Banner kind="error">
            {add.error.status === 422
              ? "Este prato ou adicional não está mais disponível. Atualize o cardápio e escolha novamente."
              : add.error.message}
          </Banner>
        )}
        <small className="muted">
          Prévia da seleção. O valor final é confirmado ao adicionar.
        </small>
        <Button
          size="lg"
          disabled={locked || !product.disponivel || add.busy}
          loading={add.isPending}
          onClick={() => add.mutate()}
        >
          Adicionar ao rascunho ({moeda(preview)})
        </Button>
      </div>
    </section>
  );
}
const itemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().int().min(1),
  observacao: z.string().max(200),
  adicionaisIds: z.array(z.string().uuid()),
});
function EditItem({
  item,
  pedidoId,
  onClose,
}: {
  item: ItemPedido;
  pedidoId: string;
  onClose: () => void;
}) {
  const menu = useRead<ProdutoView[]>("tablet", "/mesa/cardapio");
  const [value, setValue] = useState<ItemInput>({
    produtoId: item.produtoId,
    quantidade: item.quantidade,
    observacao: item.observacao ?? "",
    adicionaisIds: item.adicionais.map((a) => a.id),
  });
  const product = menu.data?.find((p) => p.id === item.produtoId);
  const notify = useNotices((s) => s.add);
  const save = useAction(
    () =>
      tabletApi(
        `/mesa/pedidos/${pedidoId}/itens/${item.id}`,
        "PATCH",
        itemSchema.parse(value),
      ),
    {
      success: () => {
        notify("Rascunho atualizado.");
        onClose();
      },
    },
  );
  return (
    <Modal title={item.nomeProduto} onClose={onClose} drawer>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Quantidade">
          <Stepper
            value={value.quantidade}
            onChange={(quantidade) => setValue({ ...value, quantidade })}
          />
        </Field>
        <fieldset className={s.extras}>
          <legend>Adicionais</legend>
          {product?.adicionaisDisponiveis.map((a) => (
            <label key={a.id}>
              <input
                type="checkbox"
                checked={value.adicionaisIds.includes(a.id)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    adicionaisIds: e.target.checked
                      ? [...value.adicionaisIds, a.id]
                      : value.adicionaisIds.filter((id) => id !== a.id),
                  })
                }
              />
              {a.nome} · {moeda(a.preco)}
            </label>
          ))}
        </fieldset>
        <label>
          Observação
          <textarea
            className={controlClass}
            maxLength={200}
            value={value.observacao}
            onChange={(e) => setValue({ ...value, observacao: e.target.value })}
          />
        </label>
        {save.error && <Banner kind="error">{save.error.message}</Banner>}
        <Button
          type="submit"
          loading={save.isPending}
          disabled={save.busy || !product}
        >
          Salvar item
        </Button>
      </form>
    </Modal>
  );
}
export function Draft() {
  const { draft, locked, bill } = useTablet();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<ItemPedido | null>(null);
  const [expired, setExpired] = useState(false);
  const notify = useNotices((s) => s.add);
  const navigate = useNavigate();
  const send = useAction(
    () =>
      tabletApi<PedidoView>(`/mesa/pedidos/${draft!.id}/enviar`, "POST", {
        observacaoGeral: note,
      }),
    {
      success: (p) => {
        if (p.status === "CANCELADO") {
          notify("Este pedido foi cancelado. Comece outro rascunho.", "error");
          return;
        }
        notify(`Pedido Nº ${p.numeroDiario} enviado à cozinha.`);
        navigate(`/mesa/pedido-enviado/${p.id}`);
      },
      error: (e) => {
        if (e.status === 404 || e.status === 422) setExpired(true);
      },
    },
  );
  const update = useAction(
    ({ item, quantity }: { item: ItemPedido; quantity?: number }) =>
      tabletApi(
        `/mesa/pedidos/${draft!.id}/itens/${item.id}`,
        quantity ? "PATCH" : "DELETE",
        quantity
          ? {
              produtoId: item.produtoId,
              quantidade: quantity,
              observacao: item.observacao ?? "",
              adicionaisIds: item.adicionais.map((a) => a.id),
            }
          : undefined,
      ),
    {
      success: (_, v) =>
        notify(
          v.quantity ? "Rascunho atualizado." : "Item removido do rascunho.",
        ),
      error: (e) => {
        if (e.status === 404) setExpired(true);
      },
    },
  );
  return (
    <section className={s.center}>
      <div className="section-label">Antes de ir à cozinha</div>
      <h1>Seu rascunho</h1>
      <p>Ainda não enviado à cozinha.</p>
      {expired ? (
        <Empty
          title="Seu rascunho expirou"
          text="Rascunhos duram 30 minutos sem alteração. Escolha seus pratos novamente."
          action={
            <Button
              onClick={() => {
                setExpired(false);
                navigate("/mesa/cardapio");
              }}
            >
              Começar outro
            </Button>
          }
        />
      ) : !draft?.itens.length ? (
        <Empty
          title="O próximo sabor está no cardápio"
          text="Escolha um prato para começar seu pedido."
          action={<LinkButton to="/mesa/cardapio">Ver o cardápio</LinkButton>}
        />
      ) : (
        <div className="stack">
          {draft.itens.map((item) => (
            <article key={item.id} className={s.draftItem}>
              <div className="spread">
                <h2>{item.nomeProduto}</h2>
                <strong>{moeda(item.subtotal)}</strong>
              </div>
              <p>
                {item.adicionais.map((a) => a.nome).join(", ")}
                {item.observacao ? ` · ${item.observacao}` : ""}
              </p>
              <div className={s.draftItemActions}>
                <Stepper
                  value={item.quantidade}
                  disabled={locked || update.busy}
                  onChange={(quantity) => update.mutate({ item, quantity })}
                />
                <Button
                  variant="ghost"
                  disabled={locked || update.busy}
                  onClick={() => setEditing(item)}
                >
                  Editar item
                </Button>
                <Button
                  variant="danger"
                  disabled={locked || update.busy}
                  onClick={() => update.mutate({ item })}
                >
                  Remover
                </Button>
              </div>
            </article>
          ))}
          <label>
            Observação geral
            <textarea
              className={controlClass}
              maxLength={500}
              value={note}
              disabled={locked}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="spread">
            <h2>Subtotal</h2>
            <strong className="big-price">{moeda(draft.subtotal)}</strong>
          </div>
          <Banner kind="info">
            Rascunhos expiram em 30 min sem alteração.
          </Banner>
          {send.error && (
            <Banner kind="error">
              {send.error.message} Seu pedido foi preservado. Tente enviar
              novamente.
            </Banner>
          )}
          <Button
            size="lg"
            loading={send.isPending}
            disabled={
              locked ||
              send.busy ||
              update.busy ||
              bill?.status === "AGUARDANDO_PAGAMENTO"
            }
            onClick={() => send.mutate()}
          >
            {send.isError ? "Tentar enviar novamente" : "Enviar pedido"}
          </Button>
          <Link to="/mesa/cardapio">Continuar escolhendo</Link>
        </div>
      )}
      {editing && draft && (
        <EditItem
          item={editing}
          pedidoId={draft.id}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
export function OrderItems({ pedido }: { pedido: PedidoView }) {
  return (
    <article className={s.order}>
      <div className="spread">
        <strong>
          {pedido.status === "RASCUNHO"
            ? "Rascunho"
            : `Pedido Nº ${pedido.numeroDiario}`}
        </strong>
        <Tag status={pedido.status} />
      </div>
      <ul>
        {pedido.itens.map((item) => (
          <li key={item.id}>
            <div>
              <strong>
                {item.quantidade} × {item.nomeProduto}
              </strong>
              {item.adicionais.length > 0 && (
                <p>{item.adicionais.map((a) => a.nome).join(", ")}</p>
              )}
              {item.observacao && <p className="note">{item.observacao}</p>}
            </div>
            <span>{moeda(item.subtotal)}</span>
          </li>
        ))}
      </ul>
      {pedido.observacaoGeral && (
        <p className="note">{pedido.observacaoGeral}</p>
      )}
      <div className="spread">
        <span>Subtotal do pedido</span>
        <strong>{moeda(pedido.subtotal)}</strong>
      </div>
    </article>
  );
}
export function Sent() {
  const { id } = useParams();
  const { bill } = useTablet();
  const order = bill?.pedidos.find((p) => p.id === id);
  const steps = ["RECEBIDO", "EM_PREPARO", "PRONTO", "ENTREGUE"];
  return (
    <section className={`${s.center} stack`}>
      <div>
        <div className="section-label">Da nossa cozinha à sua mesa</div>
        <h1>
          Pedido {order?.numeroDiario ? `Nº ${order.numeroDiario}` : ""} enviado
        </h1>
      </div>
      <Banner kind="ok">
        Recebemos seu pedido. Você pode acompanhar cada etapa por aqui.
      </Banner>
      {order ? (
        <>
          <div className="trail" aria-label="Andamento do pedido">
            {steps.map((st, i) => (
              <span
                key={st}
                className={i <= steps.indexOf(order.status) ? "done" : ""}
              >
                {i <= steps.indexOf(order.status) ? "✓ " : "○ "}
                {labels[st]}
              </span>
            ))}
          </div>
          <OrderItems pedido={order} />
        </>
      ) : (
        <p>Atualizando seu pedido…</p>
      )}
      <div className="actions">
        <LinkButton to="/mesa/cardapio" variant="secondary">
          Voltar ao cardápio
        </LinkButton>
        <LinkButton to="/mesa/comanda">Acompanhar pedidos</LinkButton>
      </div>
    </section>
  );
}
export function Totals({ bill }: { bill: ComandaView }) {
  return (
    <div className="total-lines">
      <div>
        <span>Subtotal</span>
        <span>{moeda(bill.subtotal)}</span>
      </div>
      <div>
        <span>Taxa de serviço ({bill.taxaServicoPercentual}%)</span>
        <span>{moeda(bill.taxaServico)}</span>
      </div>
      <div>
        <span>Couvert</span>
        <span>{moeda(bill.couvert)}</span>
      </div>
      <div>
        <span>Total</span>
        <span className="big-price">{moeda(bill.total)}</span>
      </div>
    </div>
  );
}
export function TabletBill() {
  const { bill, locked } = useTablet();
  const [call, setCall] = useState(false);
  return (
    <section className={`${s.center} stack`}>
      <div>
        <div className="section-label">Tudo o que chegou à mesa</div>
        <h1>{locked ? "Aguardando pagamento" : "Sua comanda"}</h1>
      </div>
      {!bill ? (
        <Empty
          title="Sua mesa está pronta para começar"
          text="Quando você enviar um pedido, ele aparecerá aqui."
          action={<LinkButton to="/mesa/cardapio">Ver o cardápio</LinkButton>}
        />
      ) : (
        <>
          {bill.pedidos
            .filter((p) => p.status !== "RASCUNHO")
            .map((p) => (
              <OrderItems key={p.id} pedido={p} />
            ))}
          <Totals bill={bill} />
          <Button size="lg" onClick={() => setCall(true)}>
            {locked ? "Chamar garçom" : "Pedir a conta"}
          </Button>
          <p>Pedir a conta chama a equipe. O garçom fará o fechamento.</p>
        </>
      )}
      {call && <CallSheet initial="CONTA" onClose={() => setCall(false)} />}
    </section>
  );
}
export function Goodbye() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const setTablet = useSession((s) => s.setTablet);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);
  const leave = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLeaving(true);
    try {
      await tabletApi("/mesa/desparear", "POST");
      client.removeQueries({ queryKey: ["tablet"] });
      setTablet(null);
      navigate("/mesa/pareamento", { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setTablet(null);
        navigate("/mesa/pareamento", { replace: true });
        return;
      }
      setError(e instanceof ApiError ? e : new ApiError(0));
      setLeaving(false);
      inFlight.current = false;
    }
  }, [client, navigate, setTablet]);
  useEffect(() => {
    client.removeQueries({ queryKey: ["tablet", "/mesa/comanda"] });
    const timer = setTimeout(() => void leave(), 8000);
    return () => clearTimeout(timer);
  }, [client, leave]);
  return (
    <section className={s.welcome}>
      <span className={s.paid}>✓</span>
      <div className="section-label">Até a próxima</div>
      <h1>Conta paga</h1>
      <p>
        Obrigado por compartilhar a mesa com a gente. Esperamos você de volta.
      </p>
      <div>
        <Button
          size="lg"
          loading={leaving}
          disabled={leaving}
          onClick={() => void leave()}
        >
          Voltar ao pareamento
        </Button>
      </div>
      {error && <Banner kind="error">{error.message} Tente novamente.</Banner>}
      <small>Voltaremos ao pareamento em alguns segundos.</small>
    </section>
  );
}
function CallSheet({
  onClose,
  initial = "GARCOM",
}: {
  onClose: () => void;
  initial?: ChamadoView["tipo"];
}) {
  const [type, setType] = useState(initial);
  const notify = useNotices((s) => s.add);
  const [lastCall, setLastCall] = useState(() => {
    try {
      return Number(sessionStorage.getItem("plateon.lastCall")) || 0;
    } catch {
      return 0;
    }
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const action = useAction(
    () => tabletApi("/mesa/chamados", "POST", { tipo: type }),
    {
      quiet: true,
      success: () => {
        const time = Date.now();
        setLastCall(time);
        try {
          sessionStorage.setItem("plateon.lastCall", String(time));
        } catch {
          /* Em memória. */
        }
        notify("Garçom chamado. Já estamos a caminho.");
        onClose();
      },
    },
  );
  const cooldown = Math.max(0, Math.ceil((lastCall + 15000 - now) / 1000));
  return (
    <Modal title="Como podemos ajudar?" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.mutate();
        }}
      >
        <fieldset className="stack-sm">
          <legend>O que você precisa?</legend>
          {(["GARCOM", "AJUDA", "CONTA"] as const).map((t) => (
            <label key={t} className="check">
              <input
                type="radio"
                name="chamado"
                checked={type === t}
                onChange={() => setType(t)}
              />
              {labels[t]}
            </label>
          ))}
        </fieldset>
        {type === "CONTA" && (
          <p>A mesa pediu a conta. O garçom fará o fechamento.</p>
        )}
        {action.error && (
          <Banner kind="error">
            {action.error.status === 409
              ? "Já há um chamado aberto. Nossa equipe está a caminho."
              : action.error.message}
          </Banner>
        )}
        {(cooldown > 0 || action.remaining > 0) && (
          <p>
            Aguarde {Math.max(cooldown, action.remaining)} s para chamar
            novamente.
          </p>
        )}
        <Button
          type="submit"
          loading={action.isPending}
          disabled={action.busy || cooldown > 0}
        >
          Chamar garçom
        </Button>
      </form>
    </Modal>
  );
}
