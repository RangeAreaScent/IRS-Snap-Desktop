import React, { useCallback, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  FONT_FAMILIES,
  FONT_LABELS,
  FONT_SIZE_LABELS,
  FONT_SIZES,
  FREE_THEMES,
  PREMIUM_THEMES,
  THEME_LABELS,
  useSettings,
  type FontFamily,
  type Theme,
} from "../settings";
import { FREE_COLLECTIONS_MAX, FREE_FAVORITES_MAX, useAppData } from "../state";
import { Modal } from "./Modal";

const FONT_PREVIEW: Record<FontFamily, string> = {
  system: '-apple-system, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter Variable", sans-serif',
  atkinson: '"Atkinson Hyperlegible", sans-serif',
  quattro: '"iA Writer Quattro", sans-serif',
};

/** Detects the hidden unlock rhythm: tap-tap · pause · tap-tap · pause ·
 *  tap-tap (6 clicks). Mirrors the iOS app's SecretTapDetector. */
function useSecretRhythm(onTrigger: () => void) {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = Date.now();
    const t = taps.current;
    // A long stall means the user gave up — start fresh.
    if (t.length > 0 && now - t[t.length - 1] > 6000) t.length = 0;
    t.push(now);
    if (t.length > 6) t.splice(0, t.length - 6);
    if (t.length === 6) {
      const g = [
        t[1] - t[0],
        t[2] - t[1],
        t[3] - t[2],
        t[4] - t[3],
        t[5] - t[4],
      ];
      const pair = (x: number) => x < 700; // two quick taps
      const gap = (x: number) => x >= 700 && x <= 4500; // deliberate pause
      if (pair(g[0]) && gap(g[1]) && pair(g[2]) && gap(g[3]) && pair(g[4])) {
        taps.current = [];
        onTrigger();
      }
    }
  }, [onTrigger]);
}

/** Small preview colors per theme: [outer background, accent]. */
const SWATCH: Record<Theme, [string, string]> = {
  system: ["#ffffff", "#1c1d21"],
  light: ["#f4f5f7", "#2f6df0"],
  dark: ["#1e2023", "#5a8df5"],
  "sky-blue": ["#c9d3de", "#5c7ba3"],
  "peach-pink": ["#eac3b7", "#c77f66"],
  "deep-charcoal": ["#262424", "#e8b87a"],
  blueberry: ["#3e4e66", "#b8c9e0"],
};

export function SettingsView() {
  const {
    theme,
    setTheme,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    unlocked,
    licenseKey,
    activateLicense,
    deactivateLicense,
    togglePremiumOverride,
  } = useSettings();

  const [flash, setFlash] = useState<string | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const secretTap = useSecretRhythm(() => {
    togglePremiumOverride().then(() => {
      setFlash("Premium override toggled");
      setTimeout(() => setFlash((f) => (f ? null : f)), 2500);
    });
  });

  return (
    <div className="settings-pane">
      <div className="settings-scroll">
        <h1 className="settings-title">Settings</h1>

        <section className="settings-section">
          <h2 className="settings-heading">Appearance</h2>
          <p className="settings-sub">Free themes</p>
          <div className="theme-grid">
            {FREE_THEMES.map((t) => (
              <ThemeCard
                key={t}
                theme={t}
                selected={theme === t}
                locked={false}
                onClick={() => setTheme(t)}
              />
            ))}
          </div>
          <p className="settings-sub">
            Premium themes {unlocked ? "" : "🔒"}
          </p>
          <div className="theme-grid">
            {PREMIUM_THEMES.map((t) => (
              <ThemeCard
                key={t}
                theme={t}
                selected={theme === t}
                locked={!unlocked}
                onClick={() => unlocked && setTheme(t)}
              />
            ))}
          </div>
          {!unlocked && (
            <p className="settings-hint">
              Unlock all premium themes below.
            </p>
          )}

          <p className="settings-sub">Font</p>
          <div className="theme-grid">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f}
                className={`theme-card${
                  fontFamily === f ? " theme-card--selected" : ""
                }`}
                onClick={() => setFontFamily(f)}
              >
                <span
                  className="font-preview"
                  style={{ fontFamily: FONT_PREVIEW[f] }}
                >
                  Aa
                </span>
                <span className="theme-card__label">{FONT_LABELS[f]}</span>
                {fontFamily === f && (
                  <span className="theme-card__check">✓</span>
                )}
              </button>
            ))}
          </div>

          <p className="settings-sub">Text size</p>
          <div className="segmented">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                className={`segmented__opt${
                  fontSize === s ? " segmented__opt--on" : ""
                }`}
                onClick={() => setFontSize(s)}
              >
                {FONT_SIZE_LABELS[s]}
              </button>
            ))}
          </div>
        </section>

        <PremiumSection
          unlocked={unlocked}
          licenseKey={licenseKey}
          activateLicense={activateLicense}
          deactivateLicense={deactivateLicense}
          togglePremiumOverride={togglePremiumOverride}
        />

        <section className="settings-section">
          <h2 className="settings-heading">Data</h2>
          <InfoRow label="IRC (26 USC)"     value="2,145 sections" />
          <InfoRow label="Treasury Regs"    value="6,151 sections (26 CFR)" />
          <InfoRow label="IRS Forms"        value="1,036" />
          <InfoRow label="IRS Publications" value="978" />
          <InfoRow label="Source"           value="uscode.house.gov · ecfr.gov · irs.gov (public domain)" />
        </section>

        <section className="settings-section">
          <h2 className="settings-heading">Reset</h2>
          <button
            className="btn btn--block"
            onClick={() => {
              import("../recents").then(({ RecentStore }) => {
                RecentStore.clear();
                setFlash("Recently viewed cleared");
                setTimeout(() => setFlash(null), 2000);
              });
            }}
          >
            Clear Recently Viewed
          </button>
          <button
            className="btn btn--block"
            onClick={() => {
              localStorage.removeItem("hasSeenOnboarding");
              setFlash("Onboarding will show on next launch");
              setTimeout(() => setFlash(null), 2000);
            }}
          >
            Reset Onboarding
          </button>
        </section>

        <section className="settings-section">
          <h2 className="settings-heading">Help</h2>
          <button
            className="nav-row"
            onClick={() => setHowToOpen(true)}
          >
            <span className="nav-row__label">How to Use IRS Snap</span>
            <span className="nav-row__chevron">›</span>
          </button>
          <button
            className="nav-row"
            onClick={() => setAboutOpen(true)}
          >
            <span className="nav-row__label">About IRS Snap</span>
            <span className="nav-row__chevron">›</span>
          </button>
        </section>

        <section className="settings-section">
          <div
            className="settings-version"
            onClick={secretTap}
            title="IRS Snap version"
          >
            Version 1.0.0
          </div>
          {flash && <p className="settings-hint">{flash}</p>}
        </section>
      </div>

      {howToOpen && <HowToUseModal onClose={() => setHowToOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  );
}

// ───────────────────────── How to Use ─────────────────────────

function HowToUseModal({ onClose }: { onClose: () => void }) {
  const mod = isMac() ? "⌘" : "Ctrl";
  // Group kbds in an inline-flex span so they stay on a single line — a
  // bare <kbd>+<kbd> inside a flex td was wrapping vertically (each kbd on
  // its own row). White-space: nowrap inside the wrapper keeps the line
  // intact even in narrow modals.
  const Keys = ({ children }: { children: React.ReactNode }) => (
    <span className="howto-keys">{children}</span>
  );
  return (
    <Modal title="How to Use IRS Snap" onClose={onClose} width={640}>
      <div className="howto">
        <h4 className="howto__h">Search</h4>
        <table className="howto-table">
          <tbody>
            <tr><td>Search box</td><td>Find IRC §, Form, or Pub. Body text is full-text searched.</td></tr>
            <tr><td>Filter chips</td><td>Try "199A", "1040", "Pub 17", or "depreciation".</td></tr>
            <tr><td>Recently viewed</td><td>Idle state shows the last 20 items you opened.</td></tr>
          </tbody>
        </table>

        <h4 className="howto__h">Favorites &amp; Collections</h4>
        <table className="howto-table">
          <tbody>
            <tr><td>Star (☆)</td><td>Save any result to Favorites for quick access.</td></tr>
            <tr><td>Collections</td><td>Group related items — e.g. "Schedule C clients".</td></tr>
            <tr><td>Notes</td><td>Each detail view has a per-item note that travels with exports.</td></tr>
          </tbody>
        </table>

        <h4 className="howto__h">Export</h4>
        <table className="howto-table">
          <tbody>
            <tr><td>CSV</td><td>Collection ⋯ menu → Export as CSV.</td></tr>
            <tr><td>PDF</td><td>Collection ⋯ menu → Export as PDF (A4 layout with notes).</td></tr>
            <tr><td>Copy</td><td>Detail view → Copy All copies the full citation + body + note.</td></tr>
          </tbody>
        </table>

        <h4 className="howto__h">Keyboard shortcuts</h4>
        <table className="howto-table howto-table--keys">
          <tbody>
            <tr><td><Keys><kbd>↑</kbd><kbd>↓</kbd></Keys></td><td>Move between rows</td></tr>
            <tr><td><Keys><kbd>Enter</kbd></Keys></td><td>Open the highlighted row</td></tr>
            <tr><td><Keys><kbd>{mod}</kbd>+<kbd>F</kbd></Keys></td><td>Focus the search box</td></tr>
            <tr><td><Keys><kbd>{mod}</kbd>+<kbd>K</kbd></Keys></td><td>Open the command palette</td></tr>
            <tr><td><Keys><kbd>{mod}</kbd>+<kbd>C</kbd></Keys></td><td>Copy the selected citation</td></tr>
            <tr><td><Keys><kbd>{mod}</kbd>+<kbd>D</kbd></Keys></td><td>Toggle favorite</td></tr>
            <tr><td><Keys><kbd>{mod}</kbd>+<kbd>E</kbd></Keys></td><td>Export the open collection (CSV)</td></tr>
            <tr><td><Keys><kbd>{mod}</kbd>+<kbd>1</kbd>…<kbd>4</kbd></Keys></td><td>Jump to a tab</td></tr>
            <tr><td><Keys><kbd>{mod}</kbd>+<kbd>,</kbd></Keys></td><td>Open Settings</td></tr>
            <tr><td><Keys><kbd>Esc</kbd></Keys></td><td>Close palette, narrow detail, or refocus search</td></tr>
            <tr><td><Keys><kbd>←</kbd></Keys></td><td>Back to the list (narrow detail only)</td></tr>
          </tbody>
        </table>

        <h4 className="howto__h">Tips</h4>
        <table className="howto-table">
          <tbody>
            <tr><td>Splitter</td><td>Drag the boundary between the list and detail to resize. View menu → Reset Splitter Width restores the default.</td></tr>
            <tr><td>Narrow window</td><td>Under 900px the detail overlays the list. Tap "‹ Back" or press <kbd>Esc</kbd> to return.</td></tr>
            <tr><td>Themes</td><td>7 themes total. The 4 premium themes unlock with a license key.</td></tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function isMac(): boolean {
  if (typeof navigator === "undefined") return true;
  const plat = (navigator.platform || "") + " " + (navigator.userAgent || "");
  return /Mac|iPhone|iPad/.test(plat);
}

// ───────────────────────── About modal ─────────────────────────

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About IRS Snap" onClose={onClose} width={580}>
      <div className="about">
        <p className="about__pitch">
          The U.S. tax code, one keystroke away.
        </p>
        <p className="about__lead">
          IRS Snap puts the entire Internal Revenue Code, every Treasury
          regulation, every IRS form, and every publication into a single
          searchable window — no browser tabs, no irs.gov landing pages, no
          login screens.
        </p>

        <h4 className="about__h">Why it exists</h4>
        <p>
          Looking up <strong>26 USC § 199A</strong> on the official sites
          takes seven clicks through three different domains. Switching
          between a regulation and the form it powers means juggling a
          dozen PDFs. The information has always been public — getting to
          it should be quick.
        </p>

        <h4 className="about__h">Who it's for</h4>
        <p>
          Tax preparers, EAs, CPAs, paralegals, accounting students, and
          anyone who's ever needed to read a section of the IRC twice in
          one week.
        </p>

        <h4 className="about__h">What's inside</h4>
        <table className="about__coverage">
          <tbody>
            <tr><td>IRC (26 U.S.C.)</td><td>2,145 sections</td></tr>
            <tr><td>Treasury Regs (26 CFR)</td><td>6,151 sections</td></tr>
            <tr><td>IRS Forms &amp; Schedules</td><td>1,036</td></tr>
            <tr><td>IRS Publications</td><td>978</td></tr>
            <tr><td>Full-text search</td><td>FTS5 across all body text</td></tr>
            <tr><td>Cross-links</td><td>Section ↔ Form ↔ Publication</td></tr>
          </tbody>
        </table>

        <h4 className="about__h">Privacy</h4>
        <p>
          Everything ships in the app bundle. Searches happen on your
          machine — nothing is sent anywhere, ever, except the one-time
          handshake that activates a premium license. There is no
          analytics, no telemetry, no account.
        </p>

        <h4 className="about__h">Sources &amp; license</h4>
        <p className="about__small">
          IRC text from <a href="https://uscode.house.gov" onClick={openExt}>uscode.house.gov</a>.
          Treasury regulations from <a href="https://www.ecfr.gov" onClick={openExt}>ecfr.gov</a>.
          Forms and publications from <a href="https://www.irs.gov" onClick={openExt}>irs.gov</a>.
          All three sources are public domain U.S. government works.
          IRS Snap itself is © 2026 Ryan D — the app and its UI are not
          endorsed by, affiliated with, or approved by the IRS or the
          Department of the Treasury.
        </p>

        <p className="about__disclaimer">
          IRS Snap is a reference tool. Always verify with current IRS
          guidance and consult a qualified tax professional for filing or
          planning decisions.
        </p>
      </div>
    </Modal>
  );
}

function openExt(e: React.MouseEvent<HTMLAnchorElement>) {
  // The webview blocks normal anchor navigation; open in the system browser
  // via the Tauri opener plugin so users land on the real site.
  e.preventDefault();
  void openUrl((e.currentTarget as HTMLAnchorElement).href);
}

function ThemeCard({
  theme,
  selected,
  locked,
  onClick,
}: {
  theme: Theme;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const [bg, accent] = SWATCH[theme];
  return (
    <button
      className={`theme-card${selected ? " theme-card--selected" : ""}${
        locked ? " theme-card--locked" : ""
      }`}
      onClick={onClick}
    >
      <span className="theme-swatch" style={{ background: bg }}>
        <span className="theme-swatch__dot" style={{ background: accent }} />
        {locked && <span className="theme-swatch__lock">🔒</span>}
      </span>
      <span className="theme-card__label">{THEME_LABELS[theme]}</span>
      {selected && <span className="theme-card__check">✓</span>}
    </button>
  );
}

function PremiumSection({
  unlocked,
  licenseKey,
  activateLicense,
  deactivateLicense,
  togglePremiumOverride,
}: {
  unlocked: boolean;
  licenseKey: string | null;
  activateLicense: (key: string) => Promise<void>;
  deactivateLicense: () => Promise<void>;
  togglePremiumOverride: () => Promise<void>;
}) {
  const { favorites, collections } = useAppData();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDev = import.meta.env.DEV;

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      await activateLicense(key);
      setKey("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    const ok = await ask("Deactivate premium on this computer?", {
      title: "Deactivate premium",
      kind: "warning",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await deactivateLicense();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-heading">Premium</h2>
      {unlocked ? (
        <div className="premium-box premium-box--on">
          <p className="premium-box__title">✓ Premium unlocked</p>
          <p className="premium-box__text">
            Thank you for supporting IRS Snap.
          </p>
          {licenseKey && (
            <p className="premium-box__key">Key: {maskKey(licenseKey)}</p>
          )}
          <button className="btn" onClick={deactivate} disabled={busy}>
            Deactivate on this computer
          </button>
        </div>
      ) : (
        <div className="premium-box">
          <p className="premium-box__text">
            IRS Snap is free to use. A one-time premium license unlocks all
            four premium themes plus unlimited favorites and collections.
          </p>
          <p className="premium-box__text">
            Free plan: {favorites.length} / {FREE_FAVORITES_MAX} favorites
            {" · "}
            {collections.length} / {FREE_COLLECTIONS_MAX} collections. Notes
            and export are always unlimited.
          </p>
          <p className="premium-box__text">
            Enter your license key (one key works on up to 2 computers):
          </p>
          <div className="license-row">
            <input
              className="text-input"
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              spellCheck={false}
              disabled={busy}
            />
            <button
              className="btn btn--primary"
              onClick={activate}
              disabled={busy || !key.trim()}
            >
              {busy ? "Activating…" : "Activate"}
            </button>
          </div>
          {error && <p className="license-error">{error}</p>}
        </div>
      )}
      {isDev && (
        <button
          className="btn dev-btn"
          onClick={() => togglePremiumOverride()}
        >
          Dev: toggle premium override
        </button>
      )}
    </section>
  );
}

function maskKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}
