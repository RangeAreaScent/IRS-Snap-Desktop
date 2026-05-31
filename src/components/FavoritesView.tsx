import { useAppData } from "../state";
import type { Favorite } from "../types";

interface Props {
  selectedKey: string | null;
  onSelect: (compositeKey: string) => void;
}

export function FavoritesView({ selectedKey, onSelect }: Props) {
  const { favorites, removeFavorite } = useAppData();

  return (
    <div className="list-pane">
      <div className="pane-header">
        <h2 className="pane-header__title">Favorites</h2>
        <span className="pane-header__count">{favorites.length}</span>
      </div>
      <div className="list-scroll">
        {favorites.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No favorites yet</p>
            <p>Tap the ☆ on any search result to save it here.</p>
          </div>
        )}
        {favorites.map((fav) => (
          <FavoriteRow
            key={fav.compositeKey}
            fav={fav}
            selected={fav.compositeKey === selectedKey}
            onSelect={() => onSelect(fav.compositeKey)}
            onRemove={() => removeFavorite(fav.compositeKey)}
          />
        ))}
      </div>
    </div>
  );
}

function FavoriteRow({
  fav,
  selected,
  onSelect,
  onRemove,
}: {
  fav: Favorite;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const badge =
    fav.kind === "provision"
      ? { label: "IRC", cls: "irc" }
      : fav.kind === "form"
      ? { label: "Form", cls: "form" }
      : { label: "Pub", cls: "pub" };

  return (
    <div
      className={`code-row${selected ? " code-row--selected" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <div className="code-row__main">
        <div className="code-row__top">
          <span className="code-row__code">{fav.primaryNumber}</span>
          <span className={`badge badge--${badge.cls}`}>{badge.label}</span>
        </div>
        <div className="code-row__desc">{fav.headlineText}</div>
        {fav.secondaryText && (
          <div className="code-row__chapter">{fav.secondaryText}</div>
        )}
      </div>
      <button
        className="star-btn star-btn--on"
        title="Remove from favorites"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ★
      </button>
    </div>
  );
}
