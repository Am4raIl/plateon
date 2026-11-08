import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { staffApi } from "../../api/client";
import { useAction, useRead } from "../../api/hooks";
import type { ChamadoAdminView, Pagina } from "../../api/types";
import { useNotices } from "../../app/store";
import {
  Banner,
  Button,
  Empty,
  ErrorState,
  LinkButton,
  PageHead,
  Pagination,
  Seg,
  Skeleton,
  Tag,
} from "../../design/ui";
import { mesa, minutos } from "../../lib/format";
import s from "./production.module.css";
export function Calls({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState("ABERTO");
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [success, setSuccess] = useState("");
  const [denied, setDenied] = useState(false);
  const path = `/admin/chamados?status=${status}&pagina=${page}&tamanho=20`;
  const query = useRead<Pagina<ChamadoAdminView>>("staff", path, 10000);
  const client = useQueryClient();
  const notify = useNotices((s) => s.add);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const action = useAction(
    async (c: ChamadoAdminView) => {
      await client.cancelQueries({ queryKey: ["staff", path] });
      const previous = client.getQueryData<Pagina<ChamadoAdminView>>([
        "staff",
        path,
      ]);
      if (previous)
        client.setQueryData(["staff", path], {
          ...previous,
          itens: previous.itens.filter((i) => i.id !== c.id),
        });
      try {
        return await staffApi(`/admin/chamados/${c.id}`, "PATCH", {
          status: "ATENDIDO",
        });
      } catch (error) {
        if (previous) client.setQueryData(["staff", path], previous);
        throw error;
      }
    },
    {
      quiet: true,
      error: (error) => {
        if (error.status === 403) setDenied(true);
        notify(
          error.status === 409
            ? "Outra pessoa já atendeu. Atualizamos os chamados."
            : error.message,
          "error",
        );
      },
      success: (_, c) => {
        const message = `${mesa(c.numeroMesa)} marcada como atendida.`;
        setSuccess(message);
        notify(message);
      },
    },
  );
  return (
    <section className={embedded ? s.callsPanel : "page stack"}>
      {embedded ? (
        <div className="spread">
          <h2>
            Chamados das mesas{" "}
            {query.data?.totalItens ? `(${query.data.totalItens})` : ""}
          </h2>
          <Link to="/equipe/chamados">Ver histórico</Link>
        </div>
      ) : (
        <PageHead eyebrow="Operação · atendimento" title="Chamados" />
      )}
      <div className="spread">
        {!embedded && (
          <Seg
            label="Situação dos chamados"
            value={status}
            options={[
              {
                value: "ABERTO",
                label: `Abertos${status === "ABERTO" ? ` (${query.data?.totalItens ?? 0})` : ""}`,
              },
              { value: "ATENDIDO", label: "Atendidos" },
            ]}
            onChange={(s) => {
              setStatus(s);
              setPage(0);
            }}
          />
        )}
        <small className="muted">
          {query.dataUpdatedAt
            ? `● Atualizado há ${Math.max(0, Math.floor((now - query.dataUpdatedAt) / 1000))} s · atualiza sozinho`
            : "Atualizando chamados…"}
        </small>
      </div>
      {success && <Banner kind="ok">{success}</Banner>}
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : !query.data?.itens.length ? (
        embedded ? (
          <p className="muted">
            Nenhum chamado aberto. A lista atualiza automaticamente.
          </p>
        ) : (
          <Empty
            title="Tudo atendido por aqui"
            text="Novos chamados aparecerão automaticamente."
          />
        )
      ) : (
        <>
          <div className={s.calls}>
            {query.data.itens.map((c) => (
              <article key={c.id} className={s.call}>
                <div className="spread">
                  <div>
                    <small>Mesa</small>
                    <h2>{String(c.numeroMesa).padStart(2, "0")}</h2>
                  </div>
                  <Tag status={c.tipo} />
                </div>
                <p
                  className={
                    minutos(c.criadoEm) > 10 && status === "ABERTO"
                      ? "error-text"
                      : ""
                  }
                >
                  <strong>{minutos(c.criadoEm)} min</strong>{" "}
                  {status === "ABERTO" ? "em aberto" : "desde o chamado"}
                </p>
                {c.tipo === "CONTA" && status === "ABERTO" && (
                  <p>
                    A mesa pediu a conta. O chamado será concluído ao fechar a
                    comanda.
                  </p>
                )}
                {status === "ABERTO" && c.tipo === "CONTA" && c.comandaId ? (
                  <LinkButton to={`/equipe/comandas/${c.comandaId}/fechar`}>
                    Fechar conta da mesa
                  </LinkButton>
                ) : status === "ABERTO" && c.tipo === "CONTA" ? (
                  <Button
                    variant="secondary"
                    loading={action.isPending && action.variables?.id === c.id}
                    disabled={action.busy}
                    onClick={() => action.mutate(c)}
                  >
                    Concluir chamado sem comanda ativa
                  </Button>
                ) : status === "ABERTO" && !denied ? (
                  <Button
                    loading={action.isPending && action.variables?.id === c.id}
                    disabled={action.busy}
                    onClick={() => action.mutate(c)}
                  >
                    Marcar atendido
                  </Button>
                ) : denied && status === "ABERTO" ? (
                  <Banner kind="error">
                    Acesso negado. Peça ajuda ao gerente.
                  </Banner>
                ) : (
                  <Tag status="ATENDIDO" />
                )}
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            total={query.data.totalPaginas}
            next={query.data.temProxima}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
