import { useEffect, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { useSession } from "./store";
import {
  canPay,
  canProduce,
  canServe,
  canSeeBills,
  homeFor,
} from "./permissions";
import { Banner, Brand, Button, Empty, Toasts } from "../design/ui";
import { Login } from "../features/equipe/Login";
import {
  TabletLayout,
  Pairing,
  Welcome,
  Menu,
  Product,
  Draft,
  Sent,
  TabletBill,
  Goodbye,
} from "../features/tablet/Tablet";
import { Production } from "../features/equipe/Production";
import { Calls } from "../features/equipe/Calls";
import { TabletOperations } from "../features/equipe/PairApproval";
import { Bills, BillDetail, Checkout } from "../features/comandas/Bills";
import { Dashboard } from "../features/gerencia/Dashboard";
import {
  CatalogAdmin,
  CouvertSettings,
  Devices,
} from "../features/gerencia/Admin";
import s from "./layouts.module.css";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: (count, error) =>
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500 || error.status === 429) &&
        count < 3,
      retryDelay: (count, error) =>
        error instanceof ApiError && error.status === 429
          ? error.retryAfter * 1000
          : Math.min(1000 * 2 ** count, 10000),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
function Offline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return !online ? (
    <Banner kind="warn">
      Sem conexão. Conecte este aparelho à internet para continuar.
    </Banner>
  ) : null;
}
function SessionCache() {
  useEffect(
    () =>
      useSession.subscribe((state, previous) => {
        for (const scope of ["staff", "tablet"] as const) {
          const changed =
            scope === "staff"
              ? state.staff?.token !== previous.staff?.token
              : state.tablet !== previous.tablet;
          if (changed) {
            void queryClient.cancelQueries({ queryKey: [scope] });
            queryClient.removeQueries({ queryKey: [scope] });
          }
        }
      }),
    [],
  );
  return null;
}
function Home() {
  return (
    <main id="conteudo" className={s.home}>
      <Brand />
      <div>
        <div className="section-label">À mesa e nos bastidores</div>
        <h1>
          O cuidado faz
          <br />
          parte da casa.
        </h1>
      </div>
      <div className="grid">
        <Link to="/mesa/boas-vindas">
          <h2>Estou à mesa →</h2>
          <span>Cardápio, pedidos e sua comanda.</span>
        </Link>
        <Link to="/equipe/login">
          <h2>Sou da equipe →</h2>
          <span>Produção, atendimento e gestão.</span>
        </Link>
      </div>
    </main>
  );
}
function Guard({
  test,
  children,
}: {
  test?: (
    role: NonNullable<ReturnType<typeof useSession.getState>["staff"]>["papel"],
  ) => boolean;
  children?: ReactNode;
}) {
  const session = useSession((s) => s.staff);
  const location = useLocation();
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => useSession.getState().setStaff(null),
      Math.max(0, Date.parse(session.expiraEm) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);
  if (!session)
    return (
      <Navigate
        to="/equipe/login"
        state={{ from: location.pathname, expired: true }}
        replace
      />
    );
  if (test && !test(session.papel))
    return (
      <main className="page">
        <Empty
          title="Acesso negado"
          text="Seu perfil não permite acessar esta tela."
          action={
            <Link to={homeFor(session.papel)}>Voltar para minha área</Link>
          }
        />
      </main>
    );
  return children ?? <Outlet />;
}
function StaffLayout() {
  const session = useSession((s) => s.staff)!;
  const logout = () => {
    useSession.getState().setStaff(null);
    queryClient.removeQueries({ queryKey: ["staff"] });
  };
  const role = session.papel;
  const operation = [
    ...(canProduce(role)
      ? [
          {
            to: "/equipe/pedidos",
            name: canServe(role) ? "Pedidos e chamados" : "Pedidos",
          },
        ]
      : []),
    ...(canSeeBills(role)
      ? [{ to: "/equipe/comandas", name: "Comandas" }]
      : []),
    ...(canServe(role) ? [{ to: "/equipe/tablets", name: "Tablets" }] : []),
  ];
  const management = [
    { to: "/gerencia/dashboard", name: "Dashboard" },
    { to: "/gerencia/produtos", name: "Produtos" },
    { to: "/gerencia/adicionais-mesas", name: "Mesas e adicionais" },
    { to: "/gerencia/usuarios", name: "Equipe" },
    { to: "/gerencia/couvert", name: "Couvert" },
    { to: "/gerencia/dispositivos", name: "Dispositivos" },
  ];
  const mobileOperation = operation;
  return (
    <div className={s.staff}>
      <aside className={s.side}>
        <Brand />
        <nav aria-label="Navegação principal">
          <small>Operação</small>
          {operation.map((l) => (
            <NavLink key={l.to} to={l.to}>
              {l.name}
            </NavLink>
          ))}
          {role === "GERENTE" && (
            <>
              <small>Gerência</small>
              {management.map((l) => (
                <NavLink key={l.to} to={l.to}>
                  {l.name}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <footer>
          <strong>{session.username}</strong>
          <p>
            {
              {
                COZINHA: "Cozinha",
                GARCOM: "Garçom",
                GERENTE: "Gerente",
              }[role]
            }
          </p>
          <Button variant="ghost" onClick={logout}>
            Sair da conta
          </Button>
        </footer>
      </aside>
      <div>
        <header className={s.staffHeader}>
          <Brand />
          <div>
            <p>
              {session.username} ·{" "}
              {
                {
                  COZINHA: "Cozinha",
                  GARCOM: "Garçom",
                  GERENTE: "Gerente",
                }[role]
              }
            </p>
            <Button size="sm" variant="ghost" onClick={logout}>
              Sair
            </Button>
          </div>
        </header>
        {role === "GERENTE" && (
          <nav className={s.mobileManagement} aria-label="Gerência">
            {management.map((l) => (
              <NavLink key={l.to} to={l.to}>
                {l.name}
              </NavLink>
            ))}
          </nav>
        )}
        <main id="conteudo">
          <Outlet />
        </main>
      </div>
      <nav className={s.bottom} aria-label="Navegação móvel">
        {mobileOperation.map((l) => (
          <NavLink key={l.to} to={l.to}>
            {l.name}
          </NavLink>
        ))}
        {role === "GERENTE" && (
          <NavLink to="/gerencia/dashboard">Gerência</NavLink>
        )}
      </nav>
    </div>
  );
}
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `Plateon · ${pathname.includes("/mesa") ? "À mesa" : "Restaurante"}`;
  }, [pathname]);
  return null;
}
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <a href="#conteudo" className="skip">
          Ir para o conteúdo
        </a>
        <SessionCache />
        <ScrollTop />
        <Offline />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/equipe/login" element={<Login />} />
          <Route path="/mesa/pareamento" element={<Pairing />} />
          <Route path="/mesa" element={<TabletLayout />}>
            <Route index element={<Navigate to="boas-vindas" replace />} />
            <Route path="boas-vindas" element={<Welcome />} />
            <Route path="cardapio" element={<Menu />} />
            <Route path="produto/:id" element={<Product />} />
            <Route path="rascunho" element={<Draft />} />
            <Route path="pedido-enviado/:id" element={<Sent />} />
            <Route path="comanda" element={<TabletBill />} />
            <Route path="aguardando-pagamento" element={<TabletBill />} />
            <Route path="encerramento" element={<Goodbye />} />
          </Route>
          <Route element={<Guard />}>
            <Route element={<StaffLayout />}>
              <Route element={<Guard test={canProduce} />}>
                <Route path="/equipe/pedidos" element={<Production />} />
              </Route>
              <Route element={<Guard test={canServe} />}>
                <Route path="/equipe/chamados" element={<Calls />} />
                <Route
                  path="/equipe/tablets"
                  element={
                    <div className="page">
                      <TabletOperations />
                    </div>
                  }
                />
              </Route>
              <Route element={<Guard test={canSeeBills} />}>
                <Route path="/equipe/comandas" element={<Bills />} />
                <Route path="/equipe/comandas/:id" element={<BillDetail />} />
              </Route>
              <Route element={<Guard test={canPay} />}>
                <Route
                  path="/equipe/comandas/:id/fechar"
                  element={<Checkout />}
                />
              </Route>
              <Route element={<Guard test={(r) => r === "GERENTE"} />}>
                <Route path="/gerencia/dashboard" element={<Dashboard />} />
                <Route
                  path="/gerencia/produtos"
                  element={<CatalogAdmin kind="produtos" />}
                />
                <Route
                  path="/gerencia/usuarios"
                  element={<CatalogAdmin kind="usuarios" />}
                />
                <Route
                  path="/gerencia/adicionais-mesas"
                  element={<CatalogAdmin kind="adicionais" />}
                />
                <Route path="/gerencia/dispositivos" element={<Devices />} />
                <Route path="/gerencia/couvert" element={<CouvertSettings />} />
              </Route>
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <main className="blank">
                <h1>Esta página não foi encontrada</h1>
                <Link to="/">Voltar ao início</Link>
              </main>
            }
          />
        </Routes>
        <Toasts />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
