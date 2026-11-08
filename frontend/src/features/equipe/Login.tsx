import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { publicApi } from "../../api/client";
import { loginSchema } from "../../api/types";
import { useAction } from "../../api/hooks";
import { useSession } from "../../app/store";
import { homeFor } from "../../app/permissions";
import { Banner, Brand, Button, Input } from "../../design/ui";
import s from "../../app/layouts.module.css";
const schema = z.object({
  username: z.string().trim().min(1, "Informe seu usuário."),
  senha: z.string().min(1, "Informe sua senha."),
});
export function Login() {
  const session = useSession((s) => s.staff);
  const setStaff = useSession((s) => s.setStaff);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const action = useAction(
    async (values: z.infer<typeof schema>) => ({
      ...loginSchema.parse(await publicApi("/auth/login", "POST", values)),
      username: values.username,
    }),
    {
      quiet: true,
      success: (data) => {
        setStaff(data);
        const from = (location.state as { from?: string } | null)?.from;
        navigate(
          (from?.startsWith("/equipe/") && from !== "/equipe/login") ||
            from?.startsWith("/gerencia/")
            ? from!
            : homeFor(data.papel),
          { replace: true },
        );
      },
    },
  );
  if (session) return <Navigate to={homeFor(session.papel)} replace />;
  return (
    <div className={s.login}>
      <aside className={s.loginAside}>
        <Brand />
        <div>
          <div className="section-label">O salão em sintonia</div>
          <h2>
            Cada pedido.
            <br />
            No tempo certo.
          </h2>
          <p>
            Da primeira escolha à última mesa, o cuidado está em cada detalhe.
          </p>
        </div>
        <small>Panteon · Operação do restaurante</small>
      </aside>
      <main id="conteudo" className={s.loginMain}>
        <div className={s.loginForm}>
          <div>
            <div className="section-label">Acesso da equipe</div>
            <h1>Entrar</h1>
            <p>Bom trabalho começa com tudo em ordem.</p>
          </div>
          {(location.state as { expired?: boolean } | null)?.expired && (
            <Banner kind="warn">
              Sua sessão expirou. Entre novamente para continuar.
            </Banner>
          )}
          <form onSubmit={handleSubmit((v) => action.mutate(v))}>
            <Input
              label="Usuário"
              autoComplete="username"
              {...register("username")}
              error={errors.username?.message}
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              {...register("senha")}
              error={errors.senha?.message}
            />
            {action.error && (
              <Banner kind="error">
                {action.error.status === 401
                  ? "Usuário ou senha incorretos. Confira e tente de novo."
                  : action.error.message}
              </Banner>
            )}
            <Button
              type="submit"
              size="lg"
              loading={action.isPending}
              disabled={action.busy}
            >
              Entrar{action.remaining ? ` · aguarde ${action.remaining} s` : ""}
            </Button>
          </form>
          <Link to="/">Voltar ao início</Link>
        </div>
      </main>
    </div>
  );
}
