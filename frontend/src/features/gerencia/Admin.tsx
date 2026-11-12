import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { staffApi } from "../../api/client";
import { useAction, useRead } from "../../api/hooks";
import {
  categorias,
  papeis,
  type AdicionalView,
  type DispositivoView,
  type MesaView,
  type Pagina,
  type ProdutoView,
  type UsuarioView,
} from "../../api/types";
import { useNotices } from "../../app/store";
import {
  Banner,
  Button,
  Empty,
  ErrorState,
  Input,
  Modal,
  MoneyInput,
  PageHead,
  Pagination,
  Seg,
  Skeleton,
  Switch,
  Tag,
  controlClass,
} from "../../design/ui";
import { dataHora, labels, mesa, moeda, relativo } from "../../lib/format";
import { PairApproval } from "../equipe/PairApproval";
type Kind = "produtos" | "usuarios" | "adicionais" | "mesas";
type Entity = ProdutoView | UsuarioView | AdicionalView | MesaView;
const title: Record<Kind, string> = {
  produtos: "Produtos",
  usuarios: "Equipe",
  adicionais: "Adicionais",
  mesas: "Mesas",
};
const singular: Record<Kind, string> = {
  produtos: "produto",
  usuarios: "funcionário",
  adicionais: "adicional",
  mesas: "mesa",
};
const fields = z.object({
  nome: z.string().trim().max(120, "Use até 120 caracteres."),
  descricao: z.string(),
  preco: z
    .number()
    .nonnegative("Informe um valor positivo.")
    .multipleOf(0.01, "Use até duas casas decimais."),
  categoria: z.enum(categorias),
  imagemUrl: z.string(),
  estacao: z.enum(["COZINHA", "BAR"]),
  tempoPreparoEstimadoMin: z.number().int().min(1),
  disponivel: z.boolean(),
  ativo: z.boolean(),
  categorias: z.array(z.enum(categorias)),
  numero: z.number().int().min(1, "Informe um número maior que zero."),
  capacidade: z.number().int().min(1, "Informe pelo menos um lugar."),
  ativa: z.boolean(),
  username: z.string().trim().max(80, "Use até 80 caracteres."),
  senha: z.string(),
  papel: z.enum(papeis),
});
type Values = z.infer<typeof fields>;
export function editorSchema(kind: Kind, editing: boolean) {
  return fields.superRefine((v, ctx) => {
    const error = (path: keyof Values, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (kind !== "mesas" && !v.nome) error("nome", "Informe o nome.");
    if (kind === "usuarios") {
      if (!v.username) error("username", "Informe o usuário.");
      if ((!editing || v.senha) && v.senha.length < 8)
        error("senha", "Use pelo menos 8 caracteres.");
    }
    if (
      kind === "produtos" &&
      v.imagemUrl &&
      !/^https?:\/\/.+/.test(v.imagemUrl)
    )
      error(
        "imagemUrl",
        "Informe um endereço completo começando com http ou https.",
      );
    if (v.imagemUrl.length > 1000)
      error("imagemUrl", "Use até 1.000 caracteres.");
    if (
      kind === "adicionais" &&
      v.categorias.some((c) => c === "BEBIDAS" || c === "PRATOS_PRINCIPAIS")
    )
      error(
        "categorias",
        "Bebidas e pratos principais não aceitam adicionais.",
      );
  });
}
function initial(entity?: Entity): Values {
  const defaults: Values = {
    nome: "",
    descricao: "",
    preco: 0,
    categoria: "ENTRADAS",
    imagemUrl: "",
    estacao: "COZINHA",
    tempoPreparoEstimadoMin: 20,
    disponivel: true,
    ativo: true,
    categorias: [],
    numero: 1,
    capacidade: 4,
    ativa: true,
    username: "",
    senha: "",
    papel: "GARCOM",
  };
  if (!entity) return defaults;
  if ("preco" in entity) {
    defaults.nome = entity.nome;
    defaults.preco = entity.preco;
    defaults.ativo = entity.ativo;
    if ("categoria" in entity) {
      defaults.descricao = entity.descricao ?? "";
      defaults.categoria = entity.categoria;
      defaults.imagemUrl = entity.imagemUrl?.startsWith("http")
        ? entity.imagemUrl
        : "";
      defaults.estacao = entity.estacao;
      defaults.tempoPreparoEstimadoMin = entity.tempoPreparoEstimadoMin;
      defaults.disponivel = entity.disponivel;
    } else defaults.categorias = entity.categorias;
  } else if ("username" in entity) {
    defaults.nome = entity.nome;
    defaults.username = entity.username;
    defaults.papel = entity.papel;
    defaults.ativo = entity.ativo;
  } else {
    defaults.numero = entity.numero;
    defaults.capacidade = entity.capacidade;
    defaults.ativa = entity.ativa;
  }
  return defaults;
}
export function entityPayload(kind: Kind, v: Values) {
  switch (kind) {
    case "produtos":
      return {
        nome: v.nome,
        descricao: v.descricao || null,
        preco: v.preco,
        categoria: v.categoria,
        imagemUrl: v.imagemUrl || null,
        estacao: v.estacao,
        tempoPreparoEstimadoMin: v.tempoPreparoEstimadoMin,
        disponivel: v.disponivel,
        ativo: v.ativo,
      };
    case "adicionais":
      return {
        nome: v.nome,
        preco: v.preco,
        ativo: v.ativo,
        categorias: v.categorias,
      };
    case "mesas":
      return { numero: v.numero, capacidade: v.capacidade, ativa: v.ativa };
    case "usuarios":
      return {
        nome: v.nome,
        username: v.username,
        papel: v.papel,
        ativo: v.ativo,
        ...(v.senha ? { senha: v.senha } : {}),
      };
  }
}
function Editor({
  kind,
  entity,
  onClose,
}: {
  kind: Kind;
  entity?: Entity;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setError,
  } = useForm<Values>({
    resolver: zodResolver(editorSchema(kind, !!entity)),
    defaultValues: initial(entity),
  });
  const notify = useNotices((s) => s.add);
  const save = useAction(
    (v: Values) =>
      staffApi(
        `/admin/${kind}${entity ? `/${entity.id}` : ""}`,
        entity ? "PATCH" : "POST",
        entityPayload(kind, v),
      ),
    {
      quiet: true,
      success: () => {
        notify(kind === "produtos" ? "Produto salvo." : "Alterações salvas.");
        onClose();
      },
      error: (e) => {
        if (e.status === 400 || e.status === 422)
          setError(
            kind === "mesas"
              ? "numero"
              : kind === "usuarios"
                ? "username"
                : "nome",
            {
              message:
                "Confira os dados. Este valor pode já estar em uso ou não ser permitido.",
            },
          );
      },
    },
  );
  return (
    <Modal
      title={`${entity ? "Editar" : "Criar"} ${singular[kind]}`}
      onClose={onClose}
      drawer
    >
      <form onSubmit={handleSubmit((v) => save.mutate(v))}>
        {kind !== "mesas" && (
          <Input
            label="Nome"
            {...register("nome")}
            error={errors.nome?.message}
            maxLength={120}
          />
        )}
        <>
          {(kind === "produtos" || kind === "adicionais") && (
            <Controller
              name="preco"
              control={control}
              render={({ field }) => (
                <div className="stack-sm">
                  <MoneyInput
                    label="Preço"
                    value={field.value}
                    onChange={field.onChange}
                  />
                  {errors.preco && (
                    <p className="error-text" role="alert">
                      ▲ {errors.preco.message}
                    </p>
                  )}
                </div>
              )}
            />
          )}
        </>
        {kind === "produtos" && (
          <>
            <label>
              Descrição
              <textarea className={controlClass} {...register("descricao")} />
            </label>
            <label>
              Categoria
              <select className={controlClass} {...register("categoria")}>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {labels[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estação
              <select className={controlClass} {...register("estacao")}>
                <option value="COZINHA">Cozinha</option>
                <option value="BAR">Bar</option>
              </select>
            </label>
            <Input
              label="Preparo estimado (minutos)"
              type="number"
              min={1}
              {...register("tempoPreparoEstimadoMin", { valueAsNumber: true })}
              error={errors.tempoPreparoEstimadoMin?.message}
            />
            <Input
              label="Endereço da imagem"
              placeholder="https://…"
              {...register("imagemUrl")}
              error={errors.imagemUrl?.message}
            />
            {entity &&
              "imagemUrl" in entity &&
              entity.imagemUrl?.startsWith("/") && (
                <Banner kind="warn">
                  Este prato tem uma imagem de demonstração. Para mantê-la, não
                  salve este formulário sem informar uma nova imagem. Salvar com
                  o endereço vazio remove a imagem atual.
                </Banner>
              )}
            <p>
              <small>
                Os adicionais permitidos são definidos pelas categorias no
                cadastro de adicionais.
              </small>
            </p>
            <label className="check">
              <input type="checkbox" {...register("disponivel")} />
              Disponível no cardápio
            </label>
          </>
        )}
        {kind === "adicionais" && (
          <fieldset className="stack-sm">
            <legend>Categorias permitidas</legend>
            {categorias
              .filter((c) => c !== "PRATOS_PRINCIPAIS" && c !== "BEBIDAS")
              .map((c) => (
                <label key={c} className="check">
                  <input
                    type="checkbox"
                    value={c}
                    {...register("categorias")}
                  />
                  {labels[c]}
                </label>
              ))}
            {errors.categorias && (
              <p className="error-text">{errors.categorias.message}</p>
            )}
          </fieldset>
        )}
        {kind === "usuarios" && (
          <>
            <Input
              label="Usuário"
              autoComplete="off"
              {...register("username")}
              error={errors.username?.message}
              maxLength={80}
            />
            <Input
              label={entity ? "Nova senha (deixe vazia para manter)" : "Senha"}
              type="password"
              autoComplete="new-password"
              {...register("senha")}
              error={errors.senha?.message}
            />
            <label>
              Papel
              <select className={controlClass} {...register("papel")}>
                {papeis.map((p) => (
                  <option key={p} value={p}>
                    {labels[p]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {kind === "mesas" && (
          <>
            <Input
              label="Número da mesa"
              type="number"
              min={1}
              {...register("numero", { valueAsNumber: true })}
              error={errors.numero?.message}
            />
            <Input
              label="Lugares"
              type="number"
              min={1}
              {...register("capacidade", { valueAsNumber: true })}
              error={errors.capacidade?.message}
            />
          </>
        )}
        <label className="check">
          <input
            type="checkbox"
            {...register(kind === "mesas" ? "ativa" : "ativo")}
          />
          {kind === "mesas" ? "Mesa ativa" : "Ativo"}
        </label>
        {save.error && (
          <Banner kind="error">
            {save.error.status === 422
              ? "Não foi possível salvar. Confira os dados e as regras deste cadastro."
              : save.error.message}
          </Banner>
        )}
        <div className="actions">
          <Button
            type="submit"
            loading={save.isPending}
            hidden={save.forbidden}
            disabled={save.busy}
          >
            Salvar alterações
          </Button>
          <Button variant="secondary" onClick={onClose} type="button">
            Voltar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Availability({ product }: { product: ProdutoView }) {
  const [value, setValue] = useState(product.disponivel);
  useEffect(() => setValue(product.disponivel), [product.disponivel]);
  const action = useAction(
    (next: boolean) =>
      staffApi(`/admin/produtos/${product.id}/disponibilidade`, "PATCH", {
        disponivel: next,
      }),
    { error: () => setValue(product.disponivel) },
  );
  if (action.forbidden)
    return <span className="error-text">Acesso negado</span>;
  return (
    <Switch
      label={value ? "Disponível" : "Esgotado"}
      checked={value}
      disabled={action.busy}
      onChange={(next) => {
        setValue(next);
        action.mutate(next);
      }}
    />
  );
}
function AdminList({ kind }: { kind: Kind }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState("");
  const [editor, setEditor] = useState<Entity | "new" | null>(null);
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const paged = kind === "produtos" || kind === "usuarios";
  const path = `/admin/${kind}${paged ? `?pagina=${page}&tamanho=20${kind === "produtos" ? `${search ? `&busca=${encodeURIComponent(search)}` : ""}${category ? `&categoria=${category}` : ""}${active ? `&ativo=${active}` : ""}` : ""}` : ""}`;
  const query = useRead<Pagina<Entity> | Entity[]>("staff", path);
  const notify = useNotices((s) => s.add);
  const remove = useAction(
    () => staffApi(`/admin/${kind}/${deleting!.id}`, "DELETE"),
    {
      success: () => {
        notify("Cadastro desativado.");
        setDeleting(null);
      },
    },
  );
  const data = query.data;
  const items = Array.isArray(data) ? data : data?.itens;
  const isPage = (d: typeof data): d is Pagina<Entity> =>
    !!d && !Array.isArray(d);
  return (
    <div className="stack">
      <div className="spread">
        <h2>{title[kind]}</h2>
        <Button onClick={() => setEditor("new")}>Criar {singular[kind]}</Button>
      </div>
      {kind === "produtos" && (
        <div className="grid">
          <Input
            label="Buscar produto"
            type="search"
            maxLength={120}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          <label>
            Categoria
            <select
              className={controlClass}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {labels[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Situação
            <select
              className={controlClass}
              value={active}
              onChange={(e) => {
                setActive(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </label>
        </div>
      )}
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : !items?.length ? (
        <Empty
          title="Nenhum cadastro encontrado"
          text="Revise os filtros ou crie o primeiro registro."
          action={
            <Button onClick={() => setEditor("new")}>
              Criar {singular[kind]}
            </Button>
          }
        />
      ) : (
        <div className="surface table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{kind === "mesas" ? "Mesa" : "Nome"}</th>
                {kind === "produtos" ? (
                  <>
                    <th scope="col">Categoria</th>
                    <th scope="col" className="money">
                      Preço
                    </th>
                    <th scope="col">Estação</th>
                    <th scope="col">Disponibilidade</th>
                  </>
                ) : kind === "usuarios" ? (
                  <>
                    <th scope="col">Usuário</th>
                    <th scope="col">Papel</th>
                  </>
                ) : kind === "adicionais" ? (
                  <>
                    <th scope="col" className="money">
                      Preço
                    </th>
                    <th scope="col">Categorias</th>
                  </>
                ) : (
                  <th scope="col" className="numeric">
                    Lugares
                  </th>
                )}
                <th scope="col">Situação</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const enabled = "ativa" in e ? e.ativa : e.ativo;
                return (
                  <tr key={e.id} className={!enabled ? "inactive" : ""}>
                    <th scope="row">
                      {"numero" in e ? mesa(e.numero) : e.nome}
                    </th>
                    {"categoria" in e ? (
                      <>
                        <td data-label="Categoria">{labels[e.categoria]}</td>
                        <td data-label="Preço" className="money">
                          {moeda(e.preco)}
                        </td>
                        <td data-label="Estação">{labels[e.estacao]}</td>
                        <td data-label="Disponibilidade">
                          <Availability product={e} />
                        </td>
                      </>
                    ) : "username" in e ? (
                      <>
                        <td data-label="Usuário">{e.username}</td>
                        <td data-label="Papel">{labels[e.papel]}</td>
                      </>
                    ) : "categorias" in e ? (
                      <>
                        <td data-label="Preço" className="money">
                          {moeda(e.preco)}
                        </td>
                        <td data-label="Categorias">
                          {e.categorias.map((c) => labels[c]).join(", ") ||
                            "Nenhuma"}
                        </td>
                      </>
                    ) : (
                      <td data-label="Lugares" className="numeric">
                        {e.capacidade}
                      </td>
                    )}
                    <td data-label="Situação">
                      <Tag>{enabled ? "Ativo" : "Inativo"}</Tag>
                    </td>
                    <td data-label="Ações">
                      <div className="actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditor(e)}
                        >
                          Editar
                        </Button>
                        {enabled && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleting(e)}
                          >
                            Desativar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {isPage(data) && (
        <Pagination
          page={page}
          total={data.totalPaginas}
          next={data.temProxima}
          onChange={setPage}
        />
      )}
      <>
        {editor && (
          <Editor
            kind={kind}
            entity={editor === "new" ? undefined : editor}
            onClose={() => setEditor(null)}
          />
        )}
      </>
      {deleting && (
        <Modal
          title={`Desativar ${singular[kind]}`}
          onClose={() => setDeleting(null)}
        >
          <div className="stack">
            <p>
              {kind === "usuarios"
                ? "Este usuário perderá o acesso."
                : kind === "mesas"
                  ? "O tablet desta mesa perderá o acesso. A mesa deixará de estar disponível."
                  : "Este item deixará de estar disponível para novos pedidos."}{" "}
              Os pedidos existentes mantêm seus dados.
            </p>
            {remove.error && (
              <Banner kind="error">{remove.error.message}</Banner>
            )}
            <div className="actions">
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Voltar
              </Button>
              <Button
                variant="dangerPrimary"
                loading={remove.isPending}
                hidden={remove.forbidden}
                disabled={remove.busy}
                onClick={() => remove.mutate()}
              >
                Desativar {singular[kind]}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function CatalogAdmin({ kind }: { kind: Exclude<Kind, "mesas"> }) {
  const [tab, setTab] = useState<"adicionais" | "mesas">("mesas");
  return (
    <section className="page stack">
      <PageHead
        eyebrow="Gerência · cadastros"
        title={kind === "adicionais" ? "Mesas e adicionais" : title[kind]}
      />
      {kind === "adicionais" ? (
        <>
          <Seg
            label="Tipo de cadastro"
            value={tab}
            options={[
              { value: "mesas", label: "Mesas" },
              { value: "adicionais", label: "Adicionais" },
            ]}
            onChange={setTab}
          />
          <AdminList kind={tab} key={tab} />
        </>
      ) : (
        <AdminList key={kind} kind={kind} />
      )}
    </section>
  );
}
export function CouvertSettings() {
  const query = useRead<{ valor: number }>(
    "staff",
    "/admin/configuracao/couvert",
  );
  const [value, setValue] = useState(0);
  const notify = useNotices((s) => s.add);
  useEffect(() => {
    if (query.data) setValue(query.data.valor);
  }, [query.data]);
  const save = useAction(
    () => staffApi("/admin/configuracao/couvert", "PUT", { valor: value }),
    {
      success: () =>
        notify("Valor do couvert atualizado para as próximas comandas."),
    },
  );
  return (
    <section className="page stack">
      <PageHead eyebrow="Gerência · valores" title="Couvert" />
      <p>
        Defina o valor por comanda. O valor é registrado quando a comanda é
        aberta; contas já abertas mantêm o valor original.
      </p>
      <p className="muted">
        Use R$ 0,00 quando não houver cobrança de couvert.
      </p>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : (
        <div className="surface stack" style={{ maxWidth: 480 }}>
          <p>
            Valor atual: <strong>{moeda(query.data?.valor ?? 0)}</strong>
          </p>
          <MoneyInput
            label="Novo valor do couvert"
            value={value}
            onChange={setValue}
          />
          {save.error && <Banner kind="error">{save.error.message}</Banner>}
          <Button
            disabled={
              save.busy ||
              !Number.isFinite(value) ||
              value < 0 ||
              value > 99999999.99
            }
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Salvar couvert
          </Button>
        </div>
      )}
    </section>
  );
}
export function Devices() {
  const [showHistory, setShowHistory] = useState(false);
  const query = useRead<DispositivoView[]>(
    "staff",
    "/admin/dispositivos",
    10000,
  );
  const tables = useRead<MesaView[]>("staff", "/admin/mesas");
  const [edit, setEdit] = useState<DispositivoView | null>(null);
  const [name, setName] = useState("");
  const [table, setTable] = useState("");
  const [revoke, setRevoke] = useState<DispositivoView | null>(null);
  const notify = useNotices((s) => s.add);
  const save = useAction(
    () =>
      staffApi(`/admin/dispositivos/${edit!.id}`, "PATCH", {
        nome: name,
        mesaId: table,
      }),
    {
      success: () => {
        notify("Tablet atualizado. A troca de mesa já está valendo.");
        setEdit(null);
      },
    },
  );
  const remove = useAction(
    () => staffApi(`/admin/dispositivos/${revoke!.id}`, "DELETE"),
    {
      success: () => {
        notify("Tablet revogado. O aparelho precisa de um novo pareamento.");
        setRevoke(null);
      },
    },
  );
  const visibleDevices =
    query.data?.filter((device) => showHistory || device.ativo) ?? [];
  return (
    <section className="page stack">
      <PageHead
        eyebrow="Gerência · dispositivos"
        title="Cada tablet em sua mesa"
      />
      <p>
        Trocar a mesa vale na hora: o mesmo tablet passa a atender a nova mesa.
        Só existe um tablet ativo por mesa. Revogar faz o tablet pedir um novo
        pareamento. "Online" indica pareamento ativo; "Último acesso" mostra
        quando o aparelho realmente usou o sistema.
      </p>
      <div className="actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? "Ocultar histórico" : "Mostrar tablets revogados"}
        </Button>
        <span className="muted">
          {query.data?.filter((d) => d.ativo).length ?? 0} tablets pareados
        </span>
      </div>
      <div className="stack">
        {query.isPending ? (
          <Skeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : !visibleDevices.length ? (
          <Empty
            title="Nenhum tablet pareado"
            text={
              showHistory
                ? "Ainda não há tablets registrados."
                : "Nenhum tablet ativo. Consulte o histórico ou aprove um novo código."
            }
          />
        ) : (
          <div className="surface table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Dispositivo</th>
                  <th scope="col">Mesa</th>
                  <th scope="col">Pareamento</th>
                  <th scope="col">Último acesso</th>
                  <th scope="col">Pareado em</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleDevices.map((d) => (
                  <tr key={d.id} className={!d.ativo ? "inactive" : ""}>
                    <th scope="row">{d.nome}</th>
                    <td data-label="Mesa">{mesa(d.numeroMesa)}</td>
                    <td data-label="Pareamento">
                      <Tag>{d.ativo ? "Online" : "Revogado"}</Tag>
                    </td>
                    <td data-label="Último acesso">
                      {relativo(d.ultimoAcessoEm)}
                    </td>
                    <td data-label="Pareado em">{dataHora(d.pareadoEm)}</td>
                    <td data-label="Ações">
                      {d.ativo ? (
                        <div className="actions">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEdit(d);
                              setName(d.nome);
                              setTable(d.mesaId);
                            }}
                          >
                            Renomear / trocar mesa
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setRevoke(d)}
                          >
                            Revogar
                          </Button>
                        </div>
                      ) : (
                        <span className="muted">Sem ações</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ maxWidth: 560 }}>
          <PairApproval embedded />
        </div>
      </div>
      {edit && (
        <Modal title="Atualizar tablet" onClose={() => setEdit(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Input
              label="Nome do tablet"
              value={name}
              required
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
            <label>
              Mesa
              <select
                className={controlClass}
                value={table}
                onChange={(e) => setTable(e.target.value)}
              >
                {tables.data
                  ?.filter((t) => t.ativa)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {mesa(t.numero)} · {t.capacidade} lugares
                    </option>
                  ))}
              </select>
            </label>
            <Banner kind="warn">
              A troca vale imediatamente. Confira a mesa antes de salvar.
            </Banner>
            {save.error && (
              <Banner kind="error">
                {save.error.status === 409
                  ? "A mesa escolhida já tem um tablet ativo. Revogue ou troque o aparelho atual."
                  : save.error.message}
              </Banner>
            )}
            <Button
              type="submit"
              loading={save.isPending}
              hidden={save.forbidden}
              disabled={save.busy || !table}
            >
              Salvar alterações
            </Button>
          </form>
        </Modal>
      )}
      {revoke && (
        <Modal
          title={`Revogar “${revoke.nome}”?`}
          onClose={() => setRevoke(null)}
        >
          <div className="stack">
            <p>
              O tablet perde o acesso agora e volta à tela de pareamento. A
              comanda e os pedidos da mesa não são afetados.
            </p>
            {remove.error && (
              <Banner kind="error">{remove.error.message}</Banner>
            )}
            <div className="actions">
              <Button variant="secondary" onClick={() => setRevoke(null)}>
                Voltar
              </Button>
              <Button
                variant="dangerPrimary"
                loading={remove.isPending}
                hidden={remove.forbidden}
                disabled={remove.busy}
                onClick={() => remove.mutate()}
              >
                Revogar tablet
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
