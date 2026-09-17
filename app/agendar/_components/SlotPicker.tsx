"use client";

import { useMemo, useState } from "react";

import type { TimeSlot } from "@/types/encuadrado";
import { dayKey, dayLabel, timeLabel, weekdayLabel } from "./format";

export type SlotsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; slots: TimeSlot[] };

interface Props {
  state: SlotsState;
  selected: string | null;
  onSelect: (start: string) => void;
  onRetry: () => void;
  highlightError?: boolean;
}

export function SlotPicker({
  state,
  selected,
  onSelect,
  onRetry,
  highlightError,
}: Props) {
  const days = useMemo(() => {
    if (state.status !== "ready") return [];
    const map = new Map<string, TimeSlot[]>();
    for (const slot of state.slots) {
      const key = dayKey(slot.start);
      const list = map.get(key);
      if (list) list.push(slot);
      else map.set(key, [slot]);
    }
    return [...map.entries()].map(([key, slots]) => ({ key, slots }));
  }, [state]);

  const [activeDayRaw, setActiveDay] = useState<string | null>(null);
  const activeDay =
    days.find((d) => d.key === activeDayRaw)?.key ??
    (selected ? dayKey(selected) : days[0]?.key);
  const activeSlots = days.find((d) => d.key === activeDay)?.slots ?? [];

  return (
    <section
      aria-labelledby="slots-title"
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        highlightError ? "border-red-400" : "border-slate-200"
      }`}
    >
      <h2 id="slots-title" className="text-lg font-semibold text-brand">
        1. Elige un horario
      </h2>
      <p className="mt-1 text-sm text-slate-500">Hora de Chile continental</p>

      <div className="mt-4" aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" && <SlotsSkeleton />}

        {state.status === "error" && (
          <div className="rounded-xl bg-amber-50 p-4 text-amber-900">
            <p>{state.message}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Reintentar
            </button>
          </div>
        )}

        {state.status === "ready" && days.length === 0 && (
          <div className="rounded-xl bg-slate-50 p-4 text-slate-700">
            <p className="font-medium">
              No hay horarios disponibles en los próximos 14 días.
            </p>
            <p className="mt-1 text-sm">
              Vuelve a revisar en unos días o escríbenos y buscamos un espacio
              para ti.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 text-sm font-semibold text-brand underline"
            >
              Volver a buscar
            </button>
          </div>
        )}

        {state.status === "ready" && days.length > 0 && (
          <>
            <div
              role="tablist"
              aria-label="Días disponibles"
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
            >
              {days.map((d) => {
                const isActive = d.key === activeDay;
                return (
                  <button
                    key={d.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveDay(d.key)}
                    className={`flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-sm transition ${
                      isActive
                        ? "border-brand bg-brand text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-brand"
                    }`}
                  >
                    <span className="capitalize">
                      {weekdayLabel(d.slots[0].start)}
                    </span>
                    <span className="font-semibold">
                      {dayLabel(d.slots[0].start)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              role="radiogroup"
              aria-label="Horarios del día"
              className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4"
            >
              {activeSlots.map((slot) => {
                const isSelected = slot.start === selected;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onSelect(slot.start)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      isSelected
                        ? "border-accent bg-accent text-white"
                        : "border-slate-200 text-slate-800 hover:border-accent"
                    }`}
                  >
                    {timeLabel(slot.start)}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SlotsSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Cargando horarios">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 w-[4.5rem] rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-100" />
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-500">Cargando horarios…</p>
    </div>
  );
}
