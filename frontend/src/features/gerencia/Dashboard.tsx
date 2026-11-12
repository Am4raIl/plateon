import { useState } from "react";
import { Link } from "react-router-dom";
import { useRead } from "../../api/hooks";
import type { FechamentoDiario } from "../../api/types";
import { Empty, ErrorState, Input, PageHead, Skeleton } from "../../design/ui";
import { diaOperacional, labels, moeda, numero } from "../../lib/format";
import styles from "./dashboard.module.css";
function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; quantity?: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <section className="surface stack">
      <h2>{title}</h2>
      {!rows.length ? (
        <Empty
          title="Ainda sem dados"
          text="Os dados deste dia aparecerão aqui conforme a operação avançar."
        />
      ) : (
        <div className="bar-list">
          {rows.map((r, i) => (
            <div key={`${r.label}-${i}`}>
              <div className="spread">
                <span>
                  {r.label}
                  {r.quantity !== undefined ? ` · ${r.quantity} un.` : ""}
                </span>
                <strong>{moeda(r.value)}</strong>
              </div>
              <div className="bar-track" aria-hidden="true">
                <span style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export function Dashboard() {
  const [day, setDay] = useState(diaOperacional());
  const query = useRead<FechamentoDiario>(
    "staff",
    `/admin/dashboard/fechamento-diario?dia=${day}`,
    30000,
    !!day,
  );
  if (query.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (query.isError || !query.data)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const d = query.data;
  const max = Math.max(...d.vendasPorHora.map((r) => r.receita), 1);
  const nav = [
    { path: "produtos", label: "Produtos", description: "Cardápio e preços" },
    {
      path: "adicionais-mesas",
      label: "Adicionais e mesas",
      description: "Opções e organização da casa",
    },
    { path: "usuarios", label: "Usuários", description: "Acessos da equipe" },
    {
      path: "dispositivos",
      label: "Dispositivos",
      description: "Aparelhos conectados",
    },
  ];
  return (
    <section className="page stack">
      <PageHead eyebrow="Gerência · visão do dia" title="O ritmo da casa">
        <Input
          label="Dia operacional"
          type="date"
          value={day}
          max={diaOperacional()}
          onChange={(e) => {
            if (e.target.value) setDay(e.target.value);
          }}
        />
      </PageHead>
      <p>O dia da casa começa às 04:00, no horário de São Paulo.</p>
      <section className={styles.management} aria-labelledby="management-title">
        <h2 id="management-title">Gerenciar a casa</h2>
        <nav className={styles.links} aria-label="Cadastros da gerência">
          {nav.map(({ path, label, description }) => (
            <Link className={styles.link} key={path} to={`/gerencia/${path}`}>
              <span className={styles.label}>{label}</span>
              <span className={styles.description}>{description}</span>
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </nav>
      </section>
      <div className="stats">
        {[
          { label: "Total vendido", value: moeda(d.totalVendido) },
          { label: "Pedidos", value: numero(d.totalPedidos) },
          {
            label: "Ticket médio por comanda",
            value: moeda(d.ticketMedioPorComanda),
          },
          {
            label: "Taxa de serviço arrecadada",
            value: moeda(d.taxaServicoArrecadada),
          },
        ].map((v) => (
          <article key={v.label} className="stat">
            <span className="muted">{v.label}</span>
            <strong>{v.value}</strong>
          </article>
        ))}
      </div>
      <div className="split">
        <section className="surface stack">
          <div className="spread">
            <h2>Vendas por hora</h2>
            <small className="muted">Horário de São Paulo</small>
          </div>
          {!d.vendasPorHora.length ? (
            <Empty
              title="Ainda sem vendas"
              text="As vendas do dia aparecerão aqui."
            />
          ) : (
            <>
              <svg
                className="chart"
                viewBox="0 0 720 160"
                role="img"
                aria-label="Vendas por hora. Os valores completos estão na tabela abaixo."
              >
                {d.vendasPorHora.map((r, i) => {
                  const width = 660 / Math.max(d.vendasPorHora.length, 1);
                  const h = (r.receita / max) * 115;
                  return (
                    <g key={r.hora}>
                      <rect
                        x={30 + i * width}
                        y={125 - h}
                        width={Math.max(4, width - 12)}
                        height={h}
                        rx="2"
                      >
                        <title>
                          {r.hora}h: {moeda(r.receita)}
                        </title>
                      </rect>
                      <text x={30 + i * width} y="150">
                        {r.hora}h
                      </text>
                    </g>
                  );
                })}
              </svg>
              <details className="table-wrap">
                <summary>Ver valores por hora</summary>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Hora</th>
                      <th scope="col" className="money">
                        Receita
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.vendasPorHora.map((r) => (
                      <tr key={r.hora}>
                        <th scope="row">{r.hora}h</th>
                        <td data-label="Receita" className="money">{moeda(r.receita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
          <p>
            <small>
              Vendas de itens, sem taxa e couvert. Pedidos cancelados não entram
              neste total.
            </small>
          </p>
        </section>
        <section className="surface stack">
          <h2>Tempo e cuidado</h2>
          <div className="total-lines">
            <div>
              <span>Preparo médio</span>
              <strong>
                {d.tempoMedioPreparoMin === null
                  ? "Sem dados"
                  : `${numero(d.tempoMedioPreparoMin)} min`}
              </strong>
            </div>
            <div>
              <span>Entrega média</span>
              <strong>
                {d.tempoMedioEntregaMin === null
                  ? "Sem dados"
                  : `${numero(d.tempoMedioEntregaMin)} min`}
              </strong>
            </div>
            <div>
              <span>Pedidos atrasados</span>
              <strong>{d.pedidosAtrasados}</strong>
            </div>
            <div>
              <span>Pedidos cancelados</span>
              <strong>
                {d.totalCancelados} · {moeda(d.valorCancelado)}
              </strong>
            </div>
          </div>
        </section>
      </div>
      <div className="grid">
        <Breakdown
          title="Mais pedidos da casa"
          rows={d.top10Itens.map((r) => ({
            label: r.nome,
            value: r.receita,
            quantity: r.quantidade,
          }))}
        />
        <Breakdown
          title="Vendas por categoria"
          rows={d.vendasPorCategoria.map((r) => ({
            label: labels[r.categoria],
            value: r.receita,
          }))}
        />
        <Breakdown
          title="Recebimentos por forma"
          rows={d.vendasPorFormaPagamento.map((r) => ({
            label: labels[r.forma],
            value: r.valor,
          }))}
        />
      </div>
    </section>
  );
}
