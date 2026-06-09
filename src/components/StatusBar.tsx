// Status bar shown beneath the main pane. Dataset meta on the left, ⌘K hint on
// the right. All colors via CSS vars so all 7 themes work without branching.

export function StatusBar() {
  return (
    <footer className="status-bar">
      <span className="status-bar__dot" aria-hidden="true" />
      <span className="status-bar__text">
        8,296 provisions · 1,036 forms · 978 pubs · IRC + 26 CFR + irs.gov
      </span>
      <span className="status-bar__spacer" />
      <span className="status-bar__hint">
        Press <kbd>⌘K</kbd> for commands
      </span>
    </footer>
  );
}
