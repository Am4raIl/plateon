import { useState } from "react";
import { z } from "zod";
import { useAction, useRead } from "../../api/hooks";
import { staffApi } from "../../api/client";
import type { DispositivoView, MesaView } from "../../api/types";
import { useSession, useNotices } from "../../app/store";
import {
  Banner,
  Button,
  Empty,
  ErrorState,
  Input,
  Modal,
  Skeleton,
  Tag,
  controlClass,
} from "../../design/ui";
import { mesa } from "../../lib/format";
const schema = z.object({
  codigo: z.string().regex(/^[A-Z0-9]{6}$/),
  mesaId: z.string().uuid(),
});
export function PairApproval({ embedded = false }: { embedded?: boolean }) {
  const tables = useRead<MesaView[]>("staff", "/admin/mesas");
  const [code, setCode] = useState("");
  const [table, setTable] = useState("");
  const [success, setSuccess] = useState("");
  const notify = useNotices((s) => s.add);
  const action = useAction(
    () =>
      staffApi<DispositivoView>(
        "/admin/dispositivos/pareamento/aprovar",
        "POST",
        schema.parse({
          codigo: code.replace(/\s/g, "").toUpperCase(),
          mesaId: table,
        }),
      ),
    {
      quiet: true,
      success: (d) => {
        const message = `Tablet pareado com a ${mesa(d.numeroMesa)}.`;
        setSuccess(message);
        notify(message);
        setCode("");
      },
    },
  );
  return (
    <section className="surface stack">
      <div>
        <div className="section-label">Aprovar tablet</div>
        {embedded ? <h2>Uma mesa, um tablet</h2> : <h1>Uma mesa, um tablet</h1>}
      </div>
      <p>Confira o código exibido no aparelho e a mesa antes de aprovar.</p>
      {tables.isError && (
        <ErrorState error={tables.error} retry={() => tables.refetch()} />
      )}
      {success && <Banner kind="ok">{success}</Banner>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.mutate();
        }}
      >
        <Input
          label="Código mostrado no tablet"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={7}
          placeholder="ABC 234"
          autoComplete="off"
          required
        />
        <div className="stack-sm">
          <label htmlFor="pair-table">Mesa</label>
          <select
            id="pair-table"
            className={controlClass}
            value={table}
            onChange={(e) => setTable(e.target.value)}
            required
          >
            <option value="">Escolha uma mesa</option>
            {tables.data
              ?.filter((m) => m.ativa)
              .map((m) => (
                <option value={m.id} key={m.id}>
                  {mesa(m.numero)} · {m.capacidade} lugares
                </option>
              ))}
          </select>
        </div>
        {action.error && (
          <Banner kind="error">
            {action.error.status === 409
              ? "Esta mesa já tem um tablet ativo. Despareie o aparelho atual antes de continuar."
              : action.error.status === 410
                ? "Este código venceu. Gere outro no tablet."
                : action.error.message}
          </Banner>
        )}
        <Button
          type="submit"
          loading={action.isPending}
          hidden={action.forbidden}
          disabled={
            action.busy ||
            !schema.safeParse({
              codigo: code.replace(/\s/g, "").toUpperCase(),
              mesaId: table,
            }).success
          }
        >
          Aprovar pareamento
          {action.remaining ? ` · aguarde ${action.remaining} s` : ""}
        </Button>
      </form>
    </section>
  );
}

export function TabletOperations() {
  const role = useSession((s) => s.staff?.papel);
  const devices = useRead<DispositivoView[]>(
    "staff",
    "/admin/dispositivos",
    10000,
  );
  const [selected, setSelected] = useState<DispositivoView | null>(null);
  const notify = useNotices((s) => s.add);
  const revoke = useAction(
    () => staffApi(`/admin/dispositivos/${selected!.id}`, "DELETE"),
    {
      success: () => {
        notify(`Tablet da ${mesa(selected!.numeroMesa)} despareado.`);
        setSelected(null);
      },
    },
  );
  const active = devices.data?.filter((d) => d.ativo) ?? [];
  return (
    <div className="stack">
      <PairApproval />
      <section className="surface stack">
        <h2>Tablets pareados</h2>
        <p>
          Desparear libera a mesa para um novo tablet. A comanda e os pedidos
          continuam disponíveis. "Online" indica pareamento ativo; o tablet
          só registra atividade quando acessa o sistema.
        </p>
        {devices.isPending ? (
          <Skeleton />
        ) : devices.isError ? (
          <ErrorState error={devices.error} retry={() => devices.refetch()} />
        ) : active.length === 0 ? (
          <Empty
            title="Nenhum tablet pareado"
            text="Aprove um código acima para começar."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Mesa</th>
                  <th scope="col">Tablet</th>
                  <th scope="col">Pareamento</th>
                  <th scope="col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {active.map((d) => (
                  <tr key={d.id}>
                    <th scope="row">{mesa(d.numeroMesa)}</th>
                    <td>{d.nome}</td>
                    <td>
                      <Tag>Online</Tag>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          revoke.reset();
                          setSelected(d);
                        }}
                        aria-label={`Desparear tablet da ${mesa(d.numeroMesa)}`}
                      >
                        Desparear
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <Modal
          title={`Desparear tablet da ${mesa(selected.numeroMesa)}?`}
          onClose={() => setSelected(null)}
        >
          <div className="stack">
            <p>
              O tablet perde o acesso agora e volta à tela de pareamento. A
              comanda e os pedidos da mesa não são afetados.
            </p>
            {revoke.error && (
              <Banner kind="error">{revoke.error.message}</Banner>
            )}
            <div className="actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Voltar
              </Button>
              <Button
                variant="dangerPrimary"
                loading={revoke.isPending}
                disabled={revoke.busy}
                onClick={() => revoke.mutate()}
              >
                Confirmar despareamento
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {role === "GERENTE" && (
        <p className="muted">
          <small>
            Renomear e trocar um tablet de mesa continua disponível em Gerência
            · Dispositivos.
          </small>
        </p>
      )}
    </div>
  );
}
