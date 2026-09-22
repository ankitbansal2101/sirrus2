"use client";

import { useMemo, useState } from "react";
import { CrmAgentPanel } from "@/components/crm/crm-agent-panel";
import { useCrm } from "@/components/crm/crm-provider";
import { IconSparkle } from "@/components/icons";
import {
  onCallAgentsForSlot,
  resolveSlotAgent,
  setSlotAssignment,
  slotDefForKey,
  type AgentSlotDef,
} from "@/lib/crm/agent-slots";

type Props = {
  slotKey: string;
  moduleLabel?: string;
  compact?: boolean;
};

export function PageAgentBar({ slotKey, moduleLabel, compact }: Props) {
  const { workspace, save } = useCrm();
  const [open, setOpen] = useState(false);

  const resolved = useMemo(() => (workspace ? resolveSlotAgent(workspace, slotKey) : null), [workspace, slotKey]);
  const choices = useMemo(() => (workspace ? onCallAgentsForSlot(workspace) : []), [workspace]);

  if (!workspace || !resolved) return null;

  const slot = slotDefForKey(workspace, slotKey);
  const label = moduleLabel ?? (slot ? resolved.slot.label : "Agent");

  const setAgent = (value: string) => {
    const customId = value === "__default__" ? null : value;
    save(setSlotAssignment(workspace, slotKey, customId));
  };

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "shrink-0"}`}>
        <label className="flex min-w-0 items-center gap-2 rounded-full border border-border-soft bg-[#f7f1e6] py-1 pl-2 pr-1">
          <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted sm:inline">Agent</span>
          <select
            value={resolved.customAgentId ?? "__default__"}
            onChange={(e) => setAgent(e.target.value)}
            className="max-w-[11rem] truncate bg-transparent text-[12px] font-medium text-ink outline-none sm:max-w-[14rem]"
            aria-label={`Agent for ${slot?.label ?? slotKey}`}
          >
            <option value="__default__">Default · {resolved.defaultInhouseName}</option>
            {choices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost py-1.5 text-xs">
          <IconSparkle className="size-3.5" />
          Ask
        </button>
      </div>
      <CrmAgentPanel
        open={open}
        onClose={() => setOpen(false)}
        mode={resolved.mode}
        customAgentId={resolved.customAgentId}
        focusModuleId={resolved.focusModuleId}
        moduleLabel={moduleLabel ?? label}
      />
    </>
  );
}

export function AgentPlacementSummary({ slots }: { slots: AgentSlotDef[] }) {
  if (!slots.length) return <span className="text-[12px] text-muted">Not assigned to a screen yet.</span>;
  return (
    <ul className="space-y-1 text-[12px] text-ink">
      {slots.map((s) => (
        <li key={s.key}>{s.label}</li>
      ))}
    </ul>
  );
}
