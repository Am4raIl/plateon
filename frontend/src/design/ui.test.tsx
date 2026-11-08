import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  Banner,
  Button,
  Modal,
  MoneyInput,
  Seg,
  Stepper,
  Tag,
  Toasts,
} from "./ui";
import { useNotices } from "../app/store";
it("mantém rótulo e impede duplo clique durante carregamento", () => {
  render(<Button loading>Salvar alterações</Button>);
  const button = screen.getByRole("button", { name: "Salvar alterações" });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
});
it("status usa texto e símbolo", () => {
  render(<Tag status="EM_PREPARO" />);
  expect(screen.getByText("◐ Em preparo")).toBeVisible();
});
it("stepper respeita limites e anuncia quantidade", async () => {
  const user = userEvent.setup();
  function Demo() {
    const [v, setV] = useState(1);
    return <Stepper value={v} onChange={setV} max={2} />;
  }
  render(<Demo />);
  expect(
    screen.getByRole("button", { name: "Diminuir quantidade" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
  expect(screen.getByRole("status")).toHaveTextContent("2");
  expect(
    screen.getByRole("button", { name: "Aumentar quantidade" }),
  ).toBeDisabled();
});
it("modal prende foco, fecha com Esc e devolve foco", async () => {
  const user = userEvent.setup();
  function Demo() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Abrir</button>
        {open && (
          <Modal title="Confirmar ação" onClose={() => setOpen(false)}>
            <button>Último</button>
          </Modal>
        )}
      </>
    );
  }
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  render(<Demo />, { container: root });
  await user.click(screen.getByRole("button", { name: "Abrir" }));
  expect(root).toHaveAttribute("inert");
  const first = screen.getByRole("button", { name: "Fechar janela" });
  expect(first).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole("button", { name: "Último" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Abrir" })).toHaveFocus();
  root.remove();
});
it("segmentado permite setas", async () => {
  const user = userEvent.setup();
  function Demo() {
    const [v, setV] = useState("a");
    return (
      <Seg
        label="Estação"
        value={v}
        options={[
          { value: "a", label: "Todas" },
          { value: "b", label: "Bar" },
        ]}
        onChange={setV}
      />
    );
  }
  render(<Demo />);
  screen.getByRole("button", { name: "Todas" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("button", { name: "Bar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it("aceita valor em BRL sem interromper a digitação", async () => {
  const user = userEvent.setup();
  function Demo() {
    const [v, setV] = useState(0);
    return (
      <>
        <MoneyInput label="Valor" value={v} onChange={setV} />
        <output data-testid="valor">{v}</output>
      </>
    );
  }
  render(<Demo />);
  await user.type(screen.getByLabelText("Valor"), "126,60");
  await user.tab();
  expect(screen.getByTestId("valor")).toHaveTextContent("126.6");
  expect(screen.getByLabelText("Valor")).toHaveValue("126,60");
});
it("mensagens têm roles acessíveis e limite de três", () => {
  useNotices.setState({ notices: [] });
  useNotices.getState().add("Uma");
  useNotices.getState().add("Duas");
  useNotices.getState().add("Três");
  useNotices.getState().add("Falhou", "error");
  const { unmount } = render(<Toasts />);
  expect(screen.queryByText("Uma")).not.toBeInTheDocument();
  expect(screen.getAllByRole("status")).toHaveLength(2);
  expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
  unmount();
  useNotices.setState({ notices: [] });
});
it("banner de erro anuncia alerta", () => {
  render(<Banner kind="error">Ação recusada. Tente novamente.</Banner>);
  expect(screen.getByRole("alert")).toBeVisible();
});
