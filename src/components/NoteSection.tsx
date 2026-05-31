import { useEffect, useRef, useState } from "react";
import { useAppData } from "../state";

interface Props {
  compositeKey: string;
  displayHeader: string;
}

/**
 * Per-item note. Reads from / writes to AppData.notes (persisted via the
 * JSON document store). Used by all three detail views.
 */
export function NoteSection({ compositeKey, displayHeader }: Props) {
  const { notes, setNote, deleteNote } = useAppData();
  const existing = notes[compositeKey]?.text ?? "";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(existing);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Reset draft when navigating to a different item.
    setDraft(existing);
    setEditing(false);
  }, [compositeKey, existing]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function save() {
    const trimmed = draft.trim();
    if (trimmed) {
      setNote(compositeKey, trimmed);
    } else {
      deleteNote(compositeKey);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(existing);
    setEditing(false);
  }

  function remove() {
    if (window.confirm("Delete this note?")) {
      deleteNote(compositeKey);
      setDraft("");
      setEditing(false);
    }
  }

  return (
    <div className="note-section">
      <div className="note-section__head">
        <span className="note-section__label">Note</span>
        {existing && !editing && (
          <div className="note-section__actions">
            <button className="note-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="note-btn note-btn--danger" onClick={remove}>
              Delete
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="note-section__editor">
          <textarea
            ref={textareaRef}
            className="note-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Client 2024 return — § 199A QBI calc, see worksheet 2"
            rows={4}
          />
          <div className="note-editor__actions">
            <button className="btn" onClick={cancel}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={save}>
              Save
            </button>
          </div>
          <p className="note-section__footnote">
            Notes are stored on this device only. They don't change the
            official IRS text. Header: {displayHeader}
          </p>
        </div>
      ) : existing ? (
        <div className="note-section__body">{existing}</div>
      ) : (
        <button className="note-add-btn" onClick={() => setEditing(true)}>
          ＋ Add a note (client name, prior year calc, etc.)
        </button>
      )}
    </div>
  );
}
