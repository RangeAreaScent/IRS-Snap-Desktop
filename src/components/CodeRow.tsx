import type { SearchResult } from "../types";

interface Props {
  item: SearchResult;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

export function CodeRow({
  item,
  selected,
  favorite,
  onSelect,
  onToggleFavorite,
}: Props) {
  const { badgeLabel, badgeClass, primary, headline, secondary } = present(item);

  return (
    <div
      className={`code-row${selected ? " code-row--selected" : ""}`}
      data-key={item.id}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="code-row__main">
        <div className="code-row__top">
          <span className="code-row__code">{primary}</span>
          <span className={`badge badge--${badgeClass}`}>{badgeLabel}</span>
        </div>
        <div className="code-row__desc">{headline}</div>
        {secondary && <div className="code-row__chapter">{secondary}</div>}
      </div>
      <button
        className={`star-btn${favorite ? " star-btn--on" : ""}`}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
      >
        {favorite ? "★" : "☆"}
      </button>
    </div>
  );
}

interface Presented {
  badgeLabel: string;
  badgeClass: string;
  primary: string;
  headline: string;
  secondary: string;
}

function present(item: SearchResult): Presented {
  switch (item.kind) {
    case "provision": {
      const isIrc = item.data.source === "usc";
      return {
        badgeLabel: isIrc ? "IRC" : "Reg",
        badgeClass: isIrc ? "irc" : "reg",
        primary: item.data.shortCitation,
        headline: item.data.heading,
        secondary: item.data.popularName ?? "",
      };
    }
    case "form": {
      const { category, canonicalNumber, title, parentForm } = item.data;
      const primary =
        category === "schedule" && parentForm
          ? `${canonicalNumber} (${parentForm})`
          : canonicalNumber;
      return {
        badgeLabel:
          category === "form" ? "Form" : category === "schedule" ? "Sch" : "Notice",
        badgeClass:
          category === "form" ? "form" : category === "schedule" ? "schedule" : "notice",
        primary,
        headline: title,
        secondary:
          category === "schedule" && parentForm
            ? `Schedule of Form ${parentForm}`
            : "",
      };
    }
    case "pub":
      return {
        badgeLabel: "Pub",
        badgeClass: "pub",
        primary: `Pub ${item.data.pubNumber}`,
        headline: item.data.title,
        secondary: item.data.targetAudience ?? "",
      };
  }
}
