import type { ReactNode } from "react";
import type { SitePolicy } from "../../shared/types";
import { ORIGIN_LIST_DEFINITIONS } from "../../shared/uiMetadata";
import { InfoTooltip } from "../../shared/components/InfoTooltip";

export type OriginListKey = keyof Pick<SitePolicy, "trustedOrigins" | "blockedOrigins" | "strictOrigins" | "allowlistedOrigins" | "blocklistedOrigins">;

type OriginListDefinition = (typeof ORIGIN_LIST_DEFINITIONS)[number];

export function OriginListCard({ definition, policy, drafts, setDrafts, addOrigin, removeOrigin }: {
  definition: OriginListDefinition;
  policy: SitePolicy;
  drafts: Record<string, string>;
  setDrafts: (drafts: Record<string, string>) => void;
  addOrigin: (list: OriginListKey) => void;
  removeOrigin: (list: OriginListKey, origin: string) => void;
}) {
  const origins = policy[definition.key] as string[];
  return <div className="subCard compactSubCard">
    <SectionTitle title={definition.label} tooltip={definition.tooltip} compact />
    <p className="muted smallText">{definition.summary} {definition.requiredForMostUsers ? "Commonly useful." : "Advanced / optional."}</p>
    <div className="originInput">
      <input
        aria-label={`Add ${definition.label}`}
        placeholder="https://example.com"
        value={drafts[String(definition.key)] ?? ""}
        onChange={(event) => setDrafts({ ...drafts, [String(definition.key)]: event.currentTarget.value })}
      />
      <button onClick={() => addOrigin(definition.key)}>Add</button>
    </div>
    <ul className="originList">
      {origins.map((origin) => <li key={origin}><span>{origin}</span><button onClick={() => removeOrigin(definition.key, origin)}>Remove</button></li>)}
    </ul>
    {origins.length === 0 ? <p className="muted emptyText">No origins added.</p> : null}
  </div>;
}

export function SectionTitle({ id, title, tooltip, compact = false }: { id?: string; title: string; tooltip: string; compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";
  return <div className="sectionTitle"><Heading id={id}>{title}</Heading><InfoTooltip text={tooltip} /></div>;
}

export function ModeOption({ selected, label, summary, tooltip, onClick }: { selected: boolean; label: string; summary: string; tooltip: string; onClick: () => void }) {
  return <button type="button" className={selected ? "modeOption selected" : "modeOption"} aria-label={`${label}: ${tooltip}`} aria-pressed={selected} onClick={onClick}><strong>{label}</strong><span>{summary}</span></button>;
}

export function DefinitionRow({ title, body }: { title: string; body: ReactNode }) {
  return <div className="definitionRow"><strong>{title}</strong>{body}</div>;
}

export { InfoTooltip };
