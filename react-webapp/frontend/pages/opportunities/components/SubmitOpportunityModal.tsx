import { useEffect, useState, type FormEvent } from 'react';
import type { CreateOpportunityInput, OpportunityType } from '../types/opportunities';

const INITIAL_FORM: {
  type: OpportunityType;
  title: string;
  org: string;
  city: string;
  state: string;
  amount: string;
  stipend: string;
  deadline: string;
  tags: string;
  description: string;
  url: string;
} = {
  type: 'internship',
  title: '',
  org: '',
  city: '',
  state: '',
  amount: '',
  stipend: '',
  deadline: '',
  tags: '',
  description: '',
  url: '',
};

interface Props {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateOpportunityInput) => Promise<void>;
}

export default function SubmitOpportunityModal({ open, submitting, onClose, onSubmit }: Props) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload: CreateOpportunityInput = {
      type: form.type,
      title: form.title.trim(),
      org: form.org.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      amount: form.amount.trim() || undefined,
      stipend: form.stipend.trim() || undefined,
      deadline: form.deadline || undefined,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      description: form.description.trim(),
      url: form.url.trim() || undefined,
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit opportunity');
    }
  }

  const isScholarship = form.type === 'scholarship';
  const isInternship = form.type === 'internship';

  return (
    <div className="submission-modal-backdrop" onClick={onClose}>
      <div className="submission-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="submission-modal-header">
          <div>
            <h2 className="submission-modal-title">Submit an opportunity</h2>
            <p className="submission-modal-copy">
              Add a scholarship, internship, or networking opportunity for the community.
            </p>
          </div>
          <button type="button" className="submission-modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="submission-modal-form" onSubmit={handleSubmit}>
          <label className="submission-field">
            <span>Type</span>
            <select
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as OpportunityType }))}
            >
              <option value="internship">Internship</option>
              <option value="scholarship">Scholarship</option>
              <option value="networking">Networking</option>
            </select>
          </label>

          <div className="submission-grid">
            <label className="submission-field">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Software Engineer Intern"
                required
              />
            </label>

            <label className="submission-field">
              <span>Organization</span>
              <input
                value={form.org}
                onChange={(event) => setForm((prev) => ({ ...prev, org: event.target.value }))}
                placeholder="Google"
                required
              />
            </label>
          </div>

          <div className="submission-grid submission-grid-compact">
            <label className="submission-field">
              <span>City</span>
              <input
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="New York"
                required
              />
            </label>

            <label className="submission-field">
              <span>State</span>
              <input
                value={form.state}
                onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                placeholder="NY"
                maxLength={2}
                required
              />
            </label>

            <label className="submission-field">
              <span>Deadline</span>
              <input
                type="date"
                value={form.deadline}
                onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))}
              />
            </label>
          </div>

          <div className="submission-grid">
            {isScholarship && (
              <label className="submission-field">
                <span>Amount</span>
                <input
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="$5,000"
                />
              </label>
            )}

            {isInternship && (
              <label className="submission-field">
                <span>Stipend</span>
                <input
                  value={form.stipend}
                  onChange={(event) => setForm((prev) => ({ ...prev, stipend: event.target.value }))}
                  placeholder="$7,500/mo"
                />
              </label>
            )}

            {!isScholarship && !isInternship && <div />}

            <label className="submission-field">
              <span>URL</span>
              <input
                type="url"
                value={form.url}
                onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://example.com/opportunity"
              />
            </label>
          </div>

          <label className="submission-field">
            <span>Tags</span>
            <input
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="Python, SWE, Summer 2026"
            />
          </label>

          <label className="submission-field">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Describe the opportunity and what students should know."
              rows={5}
              required
            />
          </label>

          {error && <p className="submission-modal-error">{error}</p>}

          <div className="submission-modal-actions">
            <button type="button" className="submission-secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submission-primary-btn" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
