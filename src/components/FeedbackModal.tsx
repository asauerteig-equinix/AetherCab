import type { FeedbackInput } from "../../shared/types";
import { isAllowedFeedbackEmail } from "../../shared/feedback";

interface FeedbackModalProps {
  draft: FeedbackInput;
  open: boolean;
  sending: boolean;
  onDraftChange(next: FeedbackInput): void;
  onClose(): void;
  onSend(): void;
}

function FeedbackIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 18 18" width="16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.25 4.5C3.25 3.81 3.81 3.25 4.5 3.25H13.5C14.19 3.25 14.75 3.81 14.75 4.5V10.25C14.75 10.94 14.19 11.5 13.5 11.5H8.25L5.05 14.1C4.62 14.45 4 14.14 4 13.58V11.5H4.5C3.81 11.5 3.25 10.94 3.25 10.25V4.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path d="M6 6.75H12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      <path d="M6 8.9H10.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 18 18" width="16" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 3L8.1 9.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
      <path d="M15 3L10.5 15L8.1 9.9L3 7.5L15 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

export function FeedbackModal({ draft, open, sending, onDraftChange, onClose, onSend }: FeedbackModalProps) {
  if (!open) {
    return null;
  }

  const canSend = isAllowedFeedbackEmail(draft.email) && draft.message.trim().length > 0 && !sending;

  return (
    <div className="audit-edit-modal-backdrop" onClick={onClose}>
      <section
        aria-modal="true"
        className="panel feedback-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="feedback-modal-topbar">
          <div className="feedback-modal-heading">
            <p className="eyebrow">Feedback</p>
            <h2>Share your feedback</h2>
            <p className="feedback-modal-copy">Send a note directly from Aether C.A.D.</p>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="audit-edit-grid clean">
          <label className="audit-edit-field plain">
            <span>Email</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
              placeholder="your.email@company.com"
              autoComplete="email"
            />
          </label>
          <label className="audit-edit-field plain feedback-text-field">
            <span>Message</span>
            <textarea
              rows={8}
              value={draft.message}
              onChange={(event) => onDraftChange({ ...draft, message: event.target.value })}
              placeholder="Write your feedback here..."
            />
          </label>
        </div>

        <div className="feedback-modal-actions">
          <button className="primary-button feedback-send-button" disabled={!canSend} onClick={onSend} type="button">
            <span className="feedback-button-icon">
              <SendIcon />
            </span>
            <span>{sending ? "Sending..." : "Send feedback"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function FeedbackNavIcon() {
  return <FeedbackIcon />;
}
