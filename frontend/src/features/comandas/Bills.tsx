import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { staffApi } from "../../api/client";
import { useAction, useRead } from "../../api/hooks";
import {
  formas,
  type ComandaResumo,
  type ComandaView,
  type FechamentoView,
  type FormaPagamento,
  type MesaView,
  type Pagamento,
  type Pagina,
  type PedidoView,
  type StatusPedido,
} from "../../api/types";
import { useNotices, useSession } from "../../app/store";
import { backwards, canPay, canServe } from "../../app/permissions";
import {
  Banner,
  Button,
  Empty,
  ErrorState,
  LinkButton,
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
import {
  centavos,
  dataHora,
  labels,
  mesa,
  moeda,
  resumoPagamentos,
} from "../../lib/format";
import { OrderItems, Totals } from "../tablet/Tablet";
export function Bills() {
  const [status, setStatus] = useState("ATIVAS");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const query = useRead<Pagina<ComandaResumo>>(
    "staff",
    `/admin/comandas/resumos?status=${status}&pagina=${page}&tamanho=20`,
    10000,
  );
  const role = useSession((s) => s.staff!.papel);
  return (
    <section className="page stack">
      <PageHead eyebrow="Operação · salão" title="Comandas">
        {canServe(role) && (
          <Button onClick={() => setOpen(true)}>Abrir comanda</Button>
        )}
      </PageHead>
      <div className="row">
        <label>
          Situação{" "}
          <select
            className={controlClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            {[
              "ATIVAS",
              "ABERTA",
              "AGUARDANDO_PAGAMENTO",
              "PAGA",
              "CANCELADA",
            ].map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : !query.data?.itens.length ? (
        <Empty
          title="Nenhuma comanda nesta situação"
          text="Escolha outra situação ou aguarde novos pedidos."
        />
      ) : (
        <>
          <div className="surface table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Mesa</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Aberta em</th>
                  <th scope="col">Última atualização</th>
                  <th scope="col" className="money">
                    Total parcial
                  </th>
                  <th scope="col" style={{ textAlign: "center" }}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.itens.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{mesa(c.numeroMesa)}</th>
                    <td>
                      <Tag status={c.status} />
                    </td>
                    <td>{dataHora(c.abertaEm)}</td>
                    <td>{dataHora(c.atualizadaEm)}</td>
                    <td className="money">{moeda(c.total)}</td>
                    <td style={{ textAlign: "center" }}>
                      <Link to={`/equipe/comandas/${c.id}`}>Ver conta →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={query.data.totalPaginas}
            next={query.data.temProxima}
            onChange={setPage}
          />
        </>
      )}
      {open && <OpenBill onClose={() => setOpen(false)} />}
    </section>
  );
}
function OpenBill({ onClose }: { onClose: () => void }) {
  const tables = useRead<MesaView[]>("staff", "/admin/mesas");
  const [id, setId] = useState("");
  const navigate = useNavigate();
  const action = useAction(
    () => staffApi<ComandaView>("/admin/comandas", "POST", { mesaId: id }),
    {
      success: (c) => {
        onClose();
        navigate(`/equipe/comandas/${c.id}`);
      },
    },
  );
  return (
    <Modal title="Abrir comanda" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.mutate();
        }}
      >
        <label>
          Mesa
          <select
            className={controlClass}
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">Escolha uma mesa</option>
            {tables.data
              ?.filter((m) => m.ativa)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {mesa(m.numero)} · {m.capacidade} lugares
                </option>
              ))}
          </select>
        </label>
        {tables.isError && (
          <ErrorState error={tables.error} retry={() => tables.refetch()} />
        )}
        {action.error && <Banner kind="error">{action.error.message}</Banner>}
        <Button
          type="submit"
          loading={action.isPending}
          hidden={action.forbidden}
          disabled={action.busy || !id}
        >
          Abrir comanda
        </Button>
      </form>
    </Modal>
  );
}
export function BillDetail() {
  const { id } = useParams();
  const query = useRead<ComandaView>("staff", `/admin/comandas/${id}`, 10000);
  const role = useSession((s) => s.staff!.papel);
  const [reverse, setReverse] = useState<PedidoView | null>(null);
  const [target, setTarget] = useState<StatusPedido>("PRONTO");
  const [reason, setReason] = useState("");
  const notify = useNotices((s) => s.add);
  const action = useAction(
    () =>
      staffApi(`/admin/kanban/${reverse!.id}/status`, "PATCH", {
        novoStatus: target,
        motivo: reason.trim(),
        versao: reverse!.versao,
      }),
    {
      success: () => {
        setReverse(null);
        notify("Andamento do pedido atualizado.");
      },
    },
  );
  const resume = useAction(
    () => staffApi<ComandaView>(`/admin/comandas/${id}/retomar`, "POST"),
    { success: () => notify("Comanda aberta novamente para pedidos.") },
  );
  if (query.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (query.isError || !query.data)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const bill = query.data;
  return (
    <section className="page stack">
      <PageHead eyebrow="Operação · comanda" title={mesa(bill.numeroMesa)}>
        <Tag status={bill.status} />
      </PageHead>
      <div className="split">
        <div className="surface stack">
          <h2>Pedidos da mesa</h2>
          {bill.pedidos.map((p) => (
            <div key={p.id} className="stack" style={{ gap: 12 }}>
              <OrderItems pedido={p} />
              {p.status === "ENTREGUE" &&
                canServe(role) &&
                bill.status === "ABERTA" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    style={{ justifySelf: "start" }}
                    onClick={() => {
                      setReverse(p);
                      setReason("");
                    }}
                  >
                    Retroceder pedido entregue
                  </Button>
                )}
            </div>
          ))}
        </div>
        <aside className="surface stack">
          <Totals bill={bill} />
          {canPay(role) &&
            ["ABERTA", "AGUARDANDO_PAGAMENTO"].includes(bill.status) && (
              <LinkButton to={`/equipe/comandas/${bill.id}/fechar`} size="lg">
                Fechar conta
              </LinkButton>
            )}
          {canPay(role) && bill.status === "PAGA" && (
            <LinkButton to={`/equipe/comandas/${bill.id}/fechar`} size="lg">
              Rever fechamento / reabrir
            </LinkButton>
          )}
          {canPay(role) && bill.status === "AGUARDANDO_PAGAMENTO" && (
            <Button
              variant="secondary"
              disabled={resume.busy}
              loading={resume.isPending}
              onClick={() => resume.mutate()}
            >
              Voltar para comanda aberta
            </Button>
          )}
          <Link to="/equipe/comandas">Voltar às comandas</Link>
        </aside>
      </div>
      {reverse && (
        <Modal
          title="Retroceder pedido entregue"
          onClose={() => setReverse(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.mutate();
            }}
          >
            <Banner kind="warn">
              O pedido voltará à produção. Cozinha e bar compartilham o
              andamento.
            </Banner>
            <label>
              Voltar para
              <select
                className={controlClass}
                value={target}
                onChange={(e) => setTarget(e.target.value as StatusPedido)}
              >
                {backwards(role, reverse.status).map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Motivo obrigatório
              <textarea
                className={controlClass}
                minLength={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {action.error && (
              <Banner kind="error">{action.error.message}</Banner>
            )}
            <Button
              type="submit"
              variant="dangerPrimary"
              disabled={reason.trim().length < 3 || action.busy}
              loading={action.isPending}
              hidden={action.forbidden}
            >
              Retroceder pedido
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}
export function Checkout() {
  const { id } = useParams();
  const query = useRead<ComandaView>("staff", `/admin/comandas/${id}`, 10000);
  const [removeTax, setRemoveTax] = useState(false);
  const [removeCouvert, setRemoveCouvert] = useState(false);
  const [force, setForce] = useState(false);
  const [confirmForce, setConfirmForce] = useState<"prepare" | "close" | null>(
    null,
  );
  const [payments, setPayments] = useState<Pagamento[]>([]);
  const [form, setForm] = useState<FormaPagamento>("PIX");
  const [value, setValue] = useState(0);
  const [fieldError, setFieldError] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const role = useSession((s) => s.staff!.papel);
  const notify = useNotices((s) => s.add);
  const navigate = useNavigate();
  const client = useQueryClient();
  const prepare = useAction(
    () =>
      staffApi<FechamentoView>(`/admin/comandas/${id}/fechar`, "POST", {
        pagamentos: [],
        removerTaxa: removeTax,
        removerCouvert: removeCouvert,
        forcar: force && role === "GERENTE",
      }),
    {
      success: (r) => {
        client.setQueryData(["staff", `/admin/comandas/${id}`], r.comanda);
        setConfirmForce(null);
        notify("Conta em fechamento. Confira o total atualizado.");
      },
    },
  );
  const close = useAction(
    () =>
      staffApi<FechamentoView>(`/admin/comandas/${id}/fechar`, "POST", {
        pagamentos: payments,
        removerTaxa: removeTax,
        removerCouvert: removeCouvert,
        forcar: force && role === "GERENTE",
      }),
    {
      success: (r) => {
        notify(
          `Conta fechada. ${mesa(r.comanda.numeroMesa)} livre.${r.troco > 0 ? ` Troco: ${moeda(r.troco)}.` : ""}`,
        );
        setPayments([]);
        navigate("/equipe/comandas");
      },
    },
  );
  const reopen = useAction(
    () =>
      staffApi<ComandaView>(`/admin/comandas/${id}/reabrir`, "POST", {
        motivo: reopenReason.trim(),
      }),
    {
      success: (bill) => {
        client.setQueryData(["staff", `/admin/comandas/${id}`], bill);
        setReopenReason("");
        notify(
          "Comanda reaberta. O registro do pagamento anterior foi cancelado e guardado no histórico.",
        );
      },
    },
  );
  const resume = useAction(
    () => staffApi<ComandaView>(`/admin/comandas/${id}/retomar`, "POST"),
    {
      success: (updated) => {
        client.setQueryData(["staff", `/admin/comandas/${id}`], updated);
        setPayments([]);
        setRemoveTax(false);
        setRemoveCouvert(false);
        notify(
          "Comanda voltou a ficar aberta. O cliente pode pedir novamente.",
        );
      },
    },
  );
  if (query.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (query.isError || !query.data)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const bill = query.data;
  if (bill.status === "PAGA")
    return (
      <section className="page stack">
        <PageHead
          eyebrow="Operação · salão"
          title={`Comanda paga · ${mesa(bill.numeroMesa)}`}
        >
          <Tag status={bill.status} />
        </PageHead>
        <div className="surface stack">
          <p>
            Se houve um engano no fechamento, reabra esta comanda para corrigir
            a conta. Informe o motivo para registrar a alteração.
          </p>
          <Banner kind="warn">
            O pagamento anterior será removido desta conta e guardado no
            histórico. Se o cliente já pagou, confira a devolução ou o acerto
            antes de cobrar novamente.
          </Banner>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              reopen.mutate();
            }}
          >
            <label>
              Motivo da reabertura
              <textarea
                className={controlClass}
                required
                minLength={3}
                maxLength={500}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
              />
            </label>
            <Button
              type="submit"
              variant="secondary"
              disabled={reopen.busy || reopenReason.trim().length < 3}
              loading={reopen.isPending}
            >
              Reabrir comanda
            </Button>
          </form>
          <Link to={`/equipe/comandas/${id}`}>Ver comanda</Link>
        </div>
      </section>
    );
  if (bill.status === "CANCELADA")
    return (
      <section className="page">
        <Empty
          title="Esta comanda já foi encerrada"
          text="Consulte os dados da conta no histórico."
          action={<Link to={`/equipe/comandas/${id}`}>Ver comanda</Link>}
        />
      </section>
    );
  const pending = bill.pedidos.filter(
    (p) => !["ENTREGUE", "CANCELADO", "RASCUNHO"].includes(p.status),
  );
  const totals = resumoPagamentos(bill.total, payments);
  const chargesChanged =
    (removeTax && bill.taxaServicoPercentual !== 0) ||
    (removeCouvert && bill.couvert !== 0);
  const blocked = pending.length > 0 && !(force && role === "GERENTE");
  const busy = close.busy || prepare.busy;
  const addPayment = () => {
    if (!Number.isFinite(value) || centavos(value) <= 0) {
      setFieldError("Informe um valor maior que zero.");
      return;
    }
    if (form !== "DINHEIRO" && centavos(value) > centavos(totals.restante)) {
      setFieldError("O valor aplicado ultrapassa o restante da conta.");
      return;
    }
    const applied =
      form === "DINHEIRO"
        ? Math.min(centavos(value), centavos(totals.restante)) / 100
        : value;
    if (centavos(applied) <= 0) {
      setFieldError("Não há valor restante para aplicar à conta.");
      return;
    }
    setPayments([
      ...payments,
      {
        forma: form,
        valor: applied,
        ...(form === "DINHEIRO" ? { valorRecebido: value } : {}),
      },
    ]);
    setValue(0);
    setFieldError("");
  };
  return (
    <section className="page stack">
      <PageHead
        eyebrow="Operação · salão"
        title={`Fechar a conta · ${mesa(bill.numeroMesa)}`}
      >
        <Tag status={bill.status} />
      </PageHead>
      <div className="split">
        <div className="stack">
          <section className="surface stack">
            <div className="section-label">01 Conta</div>
            <Totals bill={bill} />
            <Switch
              label="Remover taxa de serviço"
              checked={removeTax || bill.taxaServicoPercentual === 0}
              disabled={busy || bill.taxaServicoPercentual === 0}
              onChange={setRemoveTax}
            />
            <Switch
              label="Remover couvert"
              checked={removeCouvert || bill.couvert === 0}
              disabled={busy || bill.couvert === 0}
              onChange={setRemoveCouvert}
            />
            <p>
              A taxa e o couvert selecionados são zerados antes de calcular o
              total. Atualize a conta para consultar o valor confirmado.
            </p>
            {pending.length === 0 ? (
              <Banner kind="ok">
                Todos os pedidos desta comanda estão entregues ou cancelados.
              </Banner>
            ) : (
              <Banner kind="error">
                Não dá para fechar a {mesa(bill.numeroMesa)} ainda. Há{" "}
                {pending.length} pedidos em andamento:{" "}
                {pending
                  .map(
                    (p) =>
                      `Nº ${p.numeroDiario} (${labels[p.status].toLowerCase()})`,
                  )
                  .join(", ")}
                . Entregue ou cancele antes de fechar.
                {role === "GARCOM"
                  ? " Chame o gerente se precisar de ajuda."
                  : ""}
              </Banner>
            )}
            <Button
              variant="secondary"
              disabled={blocked || busy}
              loading={prepare.isPending}
              hidden={prepare.forbidden}
              onClick={() => {
                if (force && pending.length) setConfirmForce("prepare");
                else prepare.mutate();
              }}
            >
              {chargesChanged
                ? "Atualizar total e iniciar fechamento"
                : "Iniciar fechamento sem pagamento"}
            </Button>
            <p>
              <small>
                Ao iniciar o fechamento, novos rascunhos, cancelamentos e
                retrocessos ficam bloqueados. Pedidos enviados continuam
                avançando.
              </small>
            </p>
            {prepare.error && (
              <Banner kind="error">{prepare.error.message}</Banner>
            )}
            {bill.status === "AGUARDANDO_PAGAMENTO" && (
              <div className="stack" style={{ gap: 12 }}>
                <p>
                  Fechamento iniciado por engano? Volte a comanda para aberta e
                  libere novos pedidos no tablet.
                </p>
                <Button
                  variant="secondary"
                  disabled={resume.busy || busy}
                  loading={resume.isPending}
                  onClick={() => resume.mutate()}
                >
                  Voltar para comanda aberta
                </Button>
                {resume.error && (
                  <Banner kind="error">{resume.error.message}</Banner>
                )}
              </div>
            )}
          </section>
          <section className="surface stack">
            <div className="section-label">02 Pagamentos recebidos</div>
            <h2>O que já foi recebido</h2>
            <p>
              Registre o que a equipe já confirmou na maquininha, no banco ou em
              mãos. O Plateon não cobra nem gera PIX. Várias formas somam o
              total da conta, não dividem por pessoa.
            </p>
            {payments.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Forma</th>
                      <th scope="col" className="money">
                        Valor aplicado
                      </th>
                      <th scope="col" className="money">
                        Recebido
                      </th>
                      <th scope="col" className="money">
                        Troco
                      </th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={i}>
                        <th scope="row">{labels[p.forma]}</th>
                        <td className="money">{moeda(p.valor)}</td>
                        <td className="money">
                          {p.forma === "DINHEIRO"
                            ? moeda(p.valorRecebido ?? p.valor)
                            : "—"}
                        </td>
                        <td className="money">
                          {p.forma === "DINHEIRO"
                            ? moeda((p.valorRecebido ?? p.valor) - p.valor)
                            : "—"}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              setPayments(payments.filter((_, n) => n !== i))
                            }
                          >
                            Remover
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addPayment();
              }}
            >
              <Seg
                label="Forma de pagamento"
                value={form}
                options={formas.map((f) => ({ value: f, label: labels[f] }))}
                onChange={setForm}
              />
              <MoneyInput
                label={
                  form === "DINHEIRO"
                    ? "Valor recebido em dinheiro"
                    : "Valor aplicado à conta"
                }
                value={value}
                onChange={setValue}
              />
              {form === "DINHEIRO" && (
                <p>
                  Se o valor recebido superar o restante, o troco será calculado
                  automaticamente.
                </p>
              )}
              {fieldError && <Banner kind="error">{fieldError}</Banner>}
              <Button
                type="submit"
                variant="secondary"
                disabled={busy || chargesChanged}
              >
                + Adicionar
              </Button>
              {chargesChanged && (
                <p>Atualize o total da conta antes de registrar pagamentos.</p>
              )}
            </form>
          </section>
          {role === "GERENTE" && pending.length > 0 && (
            <section
              className="surface stack"
              style={{ borderColor: "var(--erro)" }}
            >
              <div className="section-label">
                03 Pendências · somente gerente
              </div>
              <h2>Fechamento forçado</h2>
              <label className="check">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                />
                Fechar ignorando {pending.length} pedidos em andamento
              </label>
              <p>
                Pedidos já cobrados continuam sendo preparados e entregues, mas
                não poderão ser cancelados nem retrocedidos. Rascunhos da mesa
                serão cancelados.
              </p>
            </section>
          )}
        </div>
        <aside className="surface stack">
          <h2>Resumo do recebimento</h2>
          <div className="total-lines">
            <div>
              <span>Total aplicado</span>
              <strong>{moeda(totals.aplicado)}</strong>
            </div>
            <div>
              <span>Restante a registrar</span>
              <strong>{moeda(totals.restante)}</strong>
            </div>
            <div>
              <span>Troco a devolver</span>
              <strong>{moeda(totals.troco)}</strong>
            </div>
          </div>
          {centavos(totals.restante) !== 0 && (
            <Banner kind="warn">
              Os pagamentos precisam somar o total confirmado da conta.
            </Banner>
          )}
          {close.error && (
            <Banner kind="error">
              {close.error.status === 422
                ? "A soma dos pagamentos ou o estado da conta mudou. Confira o total atualizado. Seus valores foram preservados."
                : close.error.message}
            </Banner>
          )}
          <Button
            size="lg"
            variant={force && pending.length ? "dangerPrimary" : "primary"}
            loading={close.isPending}
            hidden={close.forbidden}
            disabled={
              blocked ||
              busy ||
              centavos(totals.restante) !== 0 ||
              payments.length === 0 ||
              chargesChanged
            }
            onClick={() => {
              if (force && pending.length) setConfirmForce("close");
              else close.mutate();
            }}
          >
            {force && pending.length
              ? "Forçar fechamento"
              : "Confirmar recebimento e fechar"}
          </Button>
          <p>
            Ao fechar, a comanda vira Paga, a {mesa(bill.numeroMesa)} volta a
            Livre e o tablet encerra a sessão. Se a soma não bater, nada é
            fechado e os valores permanecem para correção.
          </p>
          <Link to="/equipe/comandas">Cancelar</Link>
        </aside>
      </div>
      {confirmForce && (
        <Modal title="Forçar fechamento" onClose={() => setConfirmForce(null)}>
          <div className="stack">
            <Banner kind="error">
              Há {pending.length} pedidos em andamento. Os pedidos cobrados
              continuarão em produção e os rascunhos serão cancelados.
            </Banner>
            <p>
              {confirmForce === "close"
                ? "Confirme que os pagamentos já foram recebidos antes de fechar."
                : "A conta entrará em fechamento mesmo com os pedidos pendentes."}
            </p>
            <div className="actions">
              <Button variant="secondary" onClick={() => setConfirmForce(null)}>
                Voltar
              </Button>
              <Button
                variant="dangerPrimary"
                loading={busy}
                onClick={() =>
                  confirmForce === "close" ? close.mutate() : prepare.mutate()
                }
              >
                Forçar fechamento
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
