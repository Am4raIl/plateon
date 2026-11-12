import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  useDndContext,
  closestCenter,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "../../api/client";
import { useAction, useRead } from "../../api/hooks";
import type {
  Cartao,
  Kanban,
  PedidoView,
  StatusPedido,
  ComandaView,
} from "../../api/types";
import {
  backwards,
  canCancel,
  canServe,
  nextStatus,
} from "../../app/permissions";
import { useSession, useNotices } from "../../app/store";
import {
  Banner,
  Button,
  Empty,
  ErrorState,
  Modal,
  PageHead,
  Seg,
  Skeleton,
  Tag,
  controlClass,
} from "../../design/ui";
import { labels, mesa } from "../../lib/format";
import { useSse } from "../../lib/sse";
import { OrderItems } from "../tablet/Tablet";
import { Calls } from "./Calls";
import s from "./production.module.css";
const columns = [
  { key: "recebido", status: "RECEBIDO", title: "Recebidos" },
  { key: "emPreparo", status: "EM_PREPARO", title: "Em preparo" },
  { key: "pronto", status: "PRONTO", title: "Prontos" },
] as const;
const actionLabel: Record<string, string> = {
  RECEBIDO: "Iniciar preparo",
  EM_PREPARO: "Marcar pronto",
  PRONTO: "Entregar à mesa",
};
export function optimisticMove(
  board: Kanban,
  id: string,
  status: StatusPedido,
): Kanban {
  const card = [...board.recebido, ...board.emPreparo, ...board.pronto].find(
    (c) => c.pedido.id === id,
  );
  const copy: Kanban = {
    recebido: board.recebido.filter((c) => c.pedido.id !== id),
    emPreparo: board.emPreparo.filter((c) => c.pedido.id !== id),
    pronto: board.pronto.filter((c) => c.pedido.id !== id),
  };
  const col = columns.find((c) => c.status === status);
  if (card && col) {
    copy[col.key] = [
      ...copy[col.key],
      { ...card, pedido: { ...card.pedido, status } },
    ].sort(
      (a, b) =>
        (a.pedido.enviadoEm ?? "").localeCompare(b.pedido.enviadoEm ?? "") ||
        a.pedido.id.localeCompare(b.pedido.id),
    );
  }
  return copy;
}
function DropColumn({
  id,
  children,
  allowed,
  active,
  dragging,
}: {
  id: string;
  children: ReactNode;
  allowed: boolean;
  active: boolean;
  dragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { allowed } });
  const { measureDroppableContainers } = useDndContext();
  useLayoutEffect(() => {
    // Compact layouts reveal a drop destination only after a drag begins.
    measureDroppableContainers([id]);
  }, [id, allowed, active, measureDroppableContainers]);
  return (
    <section
      ref={setNodeRef}
      data-drop-status={id}
      data-drop-over={isOver}
      className={`${s.column} ${active ? s.active : ""} ${dragging && allowed ? s.allowed : ""} ${isOver && allowed ? s.over : ""}`}
      aria-label={labels[id]}
    >
      {children}
    </section>
  );
}
function Delivery() {
  const { setNodeRef, isOver } = useDroppable({
    id: "ENTREGUE",
    data: { allowed: true },
  });
  return (
    <div
      ref={setNodeRef}
      data-drop-status="ENTREGUE"
      data-drop-over={isOver}
      className={`${s.delivery} ${isOver ? s.over : ""}`}
    >
      ✓ Solte aqui para entregar à mesa
    </div>
  );
}
function Card({
  card,
  disabled,
  pending,
  locked,
  onMove,
  onDetail,
  onDestructive,
  overlay = false,
  onOverlayNode,
  denied = false,
}: {
  card: Cartao;
  disabled: boolean;
  pending: boolean;
  locked: boolean;
  onMove: () => void;
  onDetail: () => void;
  onDestructive: (status: StatusPedido) => void;
  overlay?: boolean;
  onOverlayNode?: (node: HTMLElement | null) => void;
  denied?: boolean;
}) {
  const role = useSession((s) => s.staff!.papel);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({
      id: overlay ? `preview-${card.pedido.id}` : card.pedido.id,
      disabled: disabled || overlay,
    });
  const p = card.pedido;
  const mixed = new Set(p.itens.map((i) => i.estacao)).size > 1;
  return (
    <article
      ref={(node) => {
        setNodeRef(node);
        if (overlay) onOverlayNode?.(node);
      }}
      data-pedido={p.id}
      data-versao={p.versao}
      aria-hidden={overlay || undefined}
      className={`${s.card} ${card.atrasado ? s.late : ""} ${isDragging ? s.dragging : ""} ${pending ? s.pending : ""} ${overlay ? s.overlay : ""}`}
    >
      <div className={s.cardMeta}>
        <div>
          <small className="muted">Mesa</small>
          <div className="tableNumber">
            {String(card.numeroMesa).padStart(2, "0")}
          </div>
        </div>
        <div>
          <strong>Nº {p.numeroDiario}</strong>
          <p>{card.minutosDecorridos} min</p>
        </div>
        <button
          ref={setActivatorNodeRef}
          className={s.grip}
          hidden={denied}
          {...attributes}
          aria-roledescription="pedido arrastável"
          {...listeners}
          onMouseDown={(e) => {
            e.currentTarget
              .closest("article")
              ?.getAnimations()
              .forEach((a) => a.cancel());
            listeners?.onMouseDown?.(e);
          }}
          onTouchStart={(e) => {
            e.currentTarget
              .closest("article")
              ?.getAnimations()
              .forEach((a) => a.cancel());
            listeners?.onTouchStart?.(e);
          }}
          onKeyDown={(e) => {
            if (e.code === "Space")
              e.currentTarget
                .closest("article")
                ?.getAnimations()
                .forEach((a) => a.cancel());
            listeners?.onKeyDown?.(e);
            if (e.key.toLowerCase() === "m") {
              e.preventDefault();
              onDetail();
            }
          }}
          aria-label={`Arrastar pedido ${p.numeroDiario}, ${mesa(card.numeroMesa)}. Espaço para pegar, setas para mover, M para ver pedido.`}
        >
          ⠿
        </button>
        <details className={s.menu}>
          <summary aria-label={`Ações do pedido ${p.numeroDiario}`}>⋯</summary>
          <div>
            <Button variant="ghost" size="sm" onClick={onDetail}>
              Ver pedido
            </Button>
            {canCancel(role, p.status, locked || denied) && (
              <Button
                variant="danger"
                size="sm"
                disabled={disabled}
                onClick={() => onDestructive("CANCELADO")}
              >
                Cancelar pedido
              </Button>
            )}
            {backwards(role, p.status, locked || denied).map((status) => (
              <Button
                key={status}
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onDestructive(status)}
              >
                Voltar a {labels[status]}
              </Button>
            ))}
          </div>
        </details>
      </div>
      {card.atrasado && (
        <span className={s.lateLabel}>
          ▲ Atrasado · {card.minutosDecorridos} min decorridos
        </span>
      )}
      <ul>
        {p.itens.slice(0, 4).map((item) => (
          <li key={item.id}>
            <strong>
              <span>{item.quantidade}×</span>
              {item.nomeProduto}
            </strong>
            {item.adicionais.length > 0 && (
              <p>+ {item.adicionais.map((a) => a.nome).join(", ")}</p>
            )}
            {item.observacao && <p className="note">{item.observacao}</p>}
          </li>
        ))}
      </ul>
      {p.itens.length > 4 && (
        <Button variant="ghost" onClick={onDetail}>
          Ver mais {p.itens.length - 4} itens
        </Button>
      )}
      {p.observacaoGeral && <p className="note">{p.observacaoGeral}</p>}
      {mixed && (
        <small className="muted">Cozinha e bar · um único andamento</small>
      )}
      {locked && (
        <>
          <Tag status="AGUARDANDO_PAGAMENTO" />
          <small>
            Avançar continua permitido. Cancelar e retroceder estão bloqueados.
          </small>
        </>
      )}
      <Button
        hidden={denied}
        disabled={disabled}
        loading={pending}
        onClick={onMove}
      >
        {actionLabel[p.status]}
      </Button>
    </article>
  );
}
export function Production() {
  const [station, setStation] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const lastDrag = useRef({ x: 0, time: 0 });
  const overlayNode = useRef<HTMLElement | null>(null);
  const motionFrame = useRef<number | null>(null);
  const resetTilt = () => {
    if (motionFrame.current !== null) cancelAnimationFrame(motionFrame.current);
    motionFrame.current = null;
    overlayNode.current?.style.setProperty("--tilt", "0deg");
  };
  const [mobileColumn, setMobileColumn] = useState("RECEBIDO");
  const [details, setDetails] = useState<Cartao | null>(null);
  const [confirm, setConfirm] = useState<{
    card: Cartao;
    target: StatusPedido;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [denied, setDenied] = useState<string[]>([]);
  const [announce, setAnnounce] = useState("");
  const client = useQueryClient();
  const queue = useRef(false);
  const drag = useRef(false);
  const changing = useRef(false);
  const boardElement = useRef<HTMLDivElement>(null);
  const positions = useRef(
    new Map<string, { rect: DOMRect; version: number }>(),
  );
  const layoutAnimations = useRef(new Map<string, Animation>());
  const dropPosition = useRef<{ id: string; rect: DOMRect } | null>(null);
  const movePositions = useRef<Map<string, DOMRect> | null>(null);
  const path = `/admin/kanban${station ? `?estacao=${station}` : ""}`;
  const key = ["staff", path];
  const board = useRead<Kanban>("staff", path, 15000, !active && !pending);
  const role = useSession((s) => s.staff!.papel);
  const username = useSession((s) => s.staff!.username);
  useLayoutEffect(() => {
    const next = new Map<string, { rect: DOMRect; version: number }>();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const nodes = Array.from(
      boardElement.current?.querySelectorAll<HTMLElement>("[data-pedido]") ??
        [],
    );
    // Read the visible positions together, then cancel movement together. This
    // avoids a layout recalculation for each card when a new order arrives.
    const visible = nodes.map((node) => {
      const id = node.dataset.pedido!;
      const animation = layoutAnimations.current.get(id);
      return {
        node,
        id,
        rect:
          animation?.playState === "running"
            ? node.getBoundingClientRect()
            : null,
        animation,
        version: Number(node.dataset.versao),
      };
    });
    visible.forEach(({ animation }) => animation?.cancel());
    layoutAnimations.current.clear();
    const measured = visible.map((item) => ({
      ...item,
      target: item.node.getBoundingClientRect(),
    }));
    measured.forEach(({ node, id, rect: visibleRect, target, version }) => {
      const previous = positions.current.get(id);
      // The DOM has already moved by this point. Apply the running animation's
      // offset to the previous layout position to avoid a mid-motion jump.
      const movingFrom =
        visibleRect && previous
          ? {
              left: previous.rect.left + visibleRect.left - target.left,
              top: previous.rect.top + visibleRect.top - target.top,
            }
          : null;
      const from =
        dropPosition.current?.id === id
          ? dropPosition.current.rect
          : (movePositions.current?.get(id) ?? movingFrom ?? previous?.rect);
      // Hidden mobile columns have no layout box. Never animate a card from
      // (0, 0) when it is later revealed by the column selector.
      if (from && target.width && node.animate && !reducedMotion) {
        const x = from.left - target.left;
        const y = from.top - target.top;
        if ((Math.abs(x) > 1 || Math.abs(y) > 1) && previous?.rect.width) {
          const duration = Math.min(560, 340 + Math.hypot(x, y) * 0.22);
          const animation = node.animate(
            [
              {
                transform: `translate(${x}px,${y}px)`,
                zIndex: 2,
              },
              { transform: "translate(0,0)", zIndex: 2 },
            ],
            { duration, easing: "cubic-bezier(.22,1,.36,1)" },
          );
          layoutAnimations.current.set(id, animation);
          animation.onfinish = () => {
            if (layoutAnimations.current.get(id) === animation)
              layoutAnimations.current.delete(id);
          };
        }
        if (previous && version > previous.version)
          node.animate(
            [
              { backgroundColor: "var(--verde-t)" },
              { backgroundColor: "var(--porcelana)" },
            ],
            { duration: 1200 },
          );
      } else if (!previous && target.width && !reducedMotion && node.animate) {
        node.animate(
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 360, easing: "cubic-bezier(.22,1,.36,1)" },
        );
      }
      next.set(id, { rect: target, version });
    });
    positions.current = next;
    dropPosition.current = null;
    movePositions.current = null;
  }, [board.data]);
  const billIds = Array.from(
    new Set(
      [
        ...(board.data?.recebido ?? []),
        ...(board.data?.emPreparo ?? []),
        ...(board.data?.pronto ?? []),
      ].map((c) => c.pedido.comandaId),
    ),
  );
  const bills = useQueries({
    queries:
      role === "COZINHA"
        ? []
        : billIds.map((id) => ({
            queryKey: ["staff", `/admin/comandas/${id}`],
            queryFn: ({ signal }: { signal: AbortSignal }) =>
              staffApi<ComandaView>(
                `/admin/comandas/${id}`,
                "GET",
                undefined,
                signal,
              ),
            refetchInterval: 10000,
            refetchIntervalInBackground: false,
          })),
  });
  const lockedIds = new Set(
    bills.flatMap((q) =>
      q.data && q.data.status !== "ABERTA" ? [q.data.id] : [],
    ),
  );
  const refresh = () => {
    if (drag.current || changing.current) {
      queue.current = true;
      return;
    }
    void client.invalidateQueries({ queryKey: ["staff", path] });
    setAnnounce("Quadro atualizado.");
  };
  const connection = useSse("staff", "/admin/kanban/eventos", refresh);
  const notify = useNotices((s) => s.add);
  const captureMovePositions = () => {
    movePositions.current = new Map(
      Array.from(
        boardElement.current?.querySelectorAll<HTMLElement>("[data-pedido]") ??
          [],
        (node) => [node.dataset.pedido!, node.getBoundingClientRect()],
      ),
    );
  };
  const move = useAction(
    async ({
      card,
      target,
      motivo,
    }: {
      card: Cartao;
      target: StatusPedido;
      motivo?: string;
    }) => {
      changing.current = true;
      setPending(card.pedido.id);
      const cancelled = client.cancelQueries({ queryKey: key });
      const snapshot = client.getQueryData<Kanban>(key);
      if (snapshot)
        client.setQueryData(
          key,
          optimisticMove(snapshot, card.pedido.id, target),
        );
      try {
        await cancelled;
        return await staffApi<PedidoView>(
          `/admin/kanban/${card.pedido.id}/status`,
          "PATCH",
          {
            novoStatus: target,
            motivo: motivo ?? null,
            versao: card.pedido.versao,
          },
        );
      } catch (error) {
        if (snapshot) client.setQueryData(key, snapshot);
        throw error;
      } finally {
        changing.current = false;
        setPending(null);
        queue.current = false;
        void client.invalidateQueries({ queryKey: key });
      }
    },
    {
      quiet: true,
      success: (p) => {
        setConfirm(null);
        setReason("");
        notify(`Pedido Nº ${p.numeroDiario} movido para ${labels[p.status]}.`);
        setAnnounce(`Pedido ${p.numeroDiario}: ${labels[p.status]}.`);
      },
      error: (e) => {
        notify(
          e.status === 409
            ? "Este pedido foi alterado por outra pessoa."
            : e.message,
          "error",
        );
        if (e.status === 403) setDenied(cards.map((c) => c.pedido.id));
        setConfirm(null);
      },
    },
  );
  const cards = board.data
    ? [...board.data.recebido, ...board.data.emPreparo, ...board.data.pronto]
    : [];
  const dragging = cards.find((c) => c.pedido.id === active);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      scrollBehavior: "auto",
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space", "Enter"],
      },
      coordinateGetter: (event, { active, currentCoordinates, context }) => {
        const source = cards.find((c) => c.pedido.id === String(active));
        if (
          !source ||
          !["ArrowRight", "ArrowLeft", "ArrowDown"].includes(event.code)
        )
          return undefined;
        const target =
          event.code === "ArrowLeft"
            ? source.pedido.status
            : nextStatus(source.pedido.status);
        const rect = target ? context.droppableRects.get(target) : undefined;
        const current = context.collisionRect;
        if (rect && current)
          return {
            x:
              currentCoordinates.x +
              rect.left +
              rect.width / 2 -
              current.left -
              current.width / 2,
            y:
              currentCoordinates.y +
              rect.top +
              Math.min(rect.height / 2, current.height / 2 + 50) -
              current.top -
              current.height / 2,
          };
        return undefined;
      },
    }),
  );
  const onEnd = (event: DragEndEvent) => {
    const card = cards.find((c) => c.pedido.id === event.active.id);
    const target = event.over?.id as StatusPedido | undefined;
    if (
      card &&
      target &&
      nextStatus(card.pedido.status) === target &&
      target !== "ENTREGUE"
    ) {
      const rect = overlayNode.current?.getBoundingClientRect();
      if (rect) dropPosition.current = { id: card.pedido.id, rect };
    }
    if (card && target && nextStatus(card.pedido.status) === target)
      captureMovePositions();
    drag.current = false;
    resetTilt();
    setActive(null);
    if (card && target && nextStatus(card.pedido.status) === target) {
      move.mutate({ card, target });
    } else {
      if (target)
        notify(
          "Mova um passo à direita. Para retroceder, use o menu do pedido.",
          "info",
        );
      if (queue.current) {
        queue.current = false;
        refresh();
      }
    }
  };
  return (
    <div className="page">
      <PageHead eyebrow="Operação · produção" title="Cada pedido, no seu tempo">
        <span>
          {username} · {labels[role]}
        </span>
      </PageHead>
      {canServe(role) && <Calls embedded />}
      <div className={s.toolbar}>
        <Seg
          label="Estação de produção"
          value={station}
          options={[
            { value: "", label: "Todas" },
            { value: "COZINHA", label: "Cozinha" },
            { value: "BAR", label: "Bar" },
          ]}
          onChange={(v) => {
            setStation(v);
            setDenied([]);
          }}
        />
        <span
          className={`${s.connection} ${connection !== "conectado" ? s.bad : ""}`}
        >
          ●{" "}
          {connection === "conectado"
            ? "Conectado"
            : connection === "reconectando"
              ? "Reconectando"
              : "Sem conexão"}
        </span>
      </div>
      {connection !== "conectado" && (
        <Banner kind="warn">
          Estamos reconectando o quadro. Aguarde a conexão para mover pedidos.
        </Banner>
      )}
      <div className={s.mobileColumns}>
        <Seg
          label="Coluna do quadro"
          value={mobileColumn}
          options={columns.map((c) => ({
            value: c.status,
            label: `${c.title} (${board.data?.[c.key].length ?? 0})`,
          }))}
          onChange={setMobileColumn}
        />
      </div>
      {board.isPending ? (
        <Skeleton />
      ) : board.isError ? (
        <ErrorState error={board.error} retry={() => board.refetch()} />
      ) : (
        <DndContext
          collisionDetection={(args) => {
            if (!args.pointerCoordinates) return closestCenter(args);
            const hits = pointerWithin(args);
            // A compact destination can overlap the lane behind it.
            const destination = hits.find(
              (hit) =>
                args.droppableContainers.find(
                  (container) => container.id === hit.id,
                )?.data.current?.allowed,
            );
            return destination ? [destination] : hits;
          }}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                "Pressione Espaço para pegar o pedido. Use as setas para escolher a próxima etapa. Pressione Espaço para soltar ou Esc para cancelar.",
            },
            announcements: {
              onDragStart: ({ active }) =>
                `Pegou pedido ${cards.find((c) => c.pedido.id === active.id)?.pedido.numeroDiario ?? ""}.`,
              onDragOver: ({ over }) =>
                over
                  ? `Destino: ${labels[String(over.id)] ?? "Entregue"}. Solte com Espaço.`
                  : "Escolha uma etapa permitida.",
              onDragEnd: () =>
                "Arraste encerrado. Confira o andamento do pedido.",
              onDragCancel: () =>
                "Arraste cancelado. O pedido continua na mesma etapa.",
            },
          }}
          sensors={sensors}
          onDragStart={(e) => {
            drag.current = true;
            lastDrag.current = { x: 0, time: performance.now() };
            resetTilt();
            setActive(String(e.active.id));
            setAnnounce(
              `Pegou pedido ${cards.find((c) => c.pedido.id === e.active.id)?.pedido.numeroDiario}. Use as setas e solte com Espaço.`,
            );
          }}
          onDragMove={(e) => {
            const now = performance.now();
            const elapsed = Math.max(16, now - lastDrag.current.time);
            const velocity = (e.delta.x - lastDrag.current.x) / elapsed;
            const angle = Math.max(
              -2.5,
              Math.min(2.5, velocity * 1.2 + e.delta.x * 0.003),
            );
            if (motionFrame.current !== null)
              cancelAnimationFrame(motionFrame.current);
            motionFrame.current = requestAnimationFrame(() => {
              overlayNode.current?.style.setProperty("--tilt", `${angle}deg`);
              motionFrame.current = null;
            });
            lastDrag.current = { x: e.delta.x, time: now };
          }}
          onDragCancel={() => {
            drag.current = false;
            resetTilt();
            setActive(null);
            if (queue.current) refresh();
          }}
          onDragEnd={onEnd}
        >
          <div ref={boardElement} className={s.board}>
            {columns.map((col) => (
              <DropColumn
                key={col.key}
                id={col.status}
                allowed={
                  !!dragging &&
                  nextStatus(dragging.pedido.status) === col.status
                }
                active={mobileColumn === col.status}
                dragging={!!active}
              >
                <header className={s.columnHeader}>
                  <h2>{col.title}</h2>
                  <span className="count">
                    {board.data?.[col.key].length ?? 0}
                  </span>
                </header>
                {board.data?.[col.key].length === 0 ? (
                  <Empty
                    title="Tudo em dia"
                    text="Os próximos pedidos aparecerão aqui."
                  />
                ) : (
                  board.data?.[col.key].map((card) => (
                    <Card
                      key={card.pedido.id}
                      card={card}
                      denied={denied.includes(card.pedido.id)}
                      disabled={
                        connection !== "conectado" ||
                        move.busy ||
                        denied.includes(card.pedido.id)
                      }
                      pending={pending === card.pedido.id}
                      locked={lockedIds.has(card.pedido.comandaId)}
                      onMove={() => {
                        captureMovePositions();
                        move.mutate({
                          card,
                          target: nextStatus(card.pedido.status)!,
                        });
                      }}
                      onDetail={() => setDetails(card)}
                      onDestructive={(target) => {
                        setConfirm({ card, target });
                        setReason("");
                      }}
                    />
                  ))
                )}
              </DropColumn>
            ))}
          </div>
          {dragging?.pedido.status === "PRONTO" && <Delivery />}
          <DragOverlay dropAnimation={null}>
            {dragging && (
              <Card
                card={dragging}
                overlay
                onOverlayNode={(node) => {
                  overlayNode.current = node;
                }}
                disabled
                pending={false}
                locked={false}
                onMove={() => {}}
                onDetail={() => {}}
                onDestructive={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}
      <p className="muted">
        <small>
          Arraste pela alça ou use o botão. Cozinha e bar compartilham o
          andamento de cada pedido.
        </small>
      </p>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      {details && (
        <Modal
          title={`Pedido Nº ${details.pedido.numeroDiario} · ${mesa(details.numeroMesa)}`}
          drawer
          onClose={() => setDetails(null)}
        >
          <OrderItems pedido={details.pedido} />
        </Modal>
      )}
      {confirm && (
        <Modal
          title={
            confirm.target === "CANCELADO"
              ? "Cancelar pedido"
              : `Voltar a ${labels[confirm.target]}`
          }
          onClose={() => setConfirm(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length >= 3)
                move.mutate({
                  card: confirm.card,
                  target: confirm.target,
                  motivo: reason.trim(),
                });
            }}
          >
            <Banner kind="warn">
              {confirm.target === "CANCELADO"
                ? "Este pedido será cancelado e não será cobrado na comanda."
                : "O andamento será alterado para todo o pedido, incluindo cozinha e bar."}
            </Banner>
            <label>
              Motivo obrigatório
              <textarea
                className={controlClass}
                value={reason}
                minLength={3}
                required
                onChange={(e) => setReason(e.target.value)}
                aria-describedby="reason-help"
              />
            </label>
            <small id="reason-help">Escreva pelo menos 3 caracteres.</small>
            {move.error && <Banner kind="error">{move.error.message}</Banner>}
            <Button
              variant="dangerPrimary"
              type="submit"
              loading={move.isPending}
              disabled={reason.trim().length < 3 || move.busy}
            >
              {confirm.target === "CANCELADO"
                ? "Cancelar pedido"
                : "Retroceder pedido"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
