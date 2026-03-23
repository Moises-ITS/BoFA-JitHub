import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';

export interface CommunityEventInput {
  club_name: string;
  event_name: string;
  event_category: string;
  date: string;
  start_time: string;
  end_time?: string;
  campus_location?: string;
  event_room?: string;
  virtual: boolean;
  has_free_food: boolean;
  is_open_to_public: boolean;
  event_link?: string;
  description?: string;
}

const INITIAL_FORM = {
  clubName: '',
  eventName: '',
  eventCategory: 'workshop',
  date: '',
  startTime: '',
  endTime: '',
  campusLocation: '',
  eventRoom: '',
  virtual: false,
  hasFreeFood: false,
  isOpenToPublic: true,
  eventLink: '',
  description: '',
};

interface Props {
  open: boolean;
  submitting: boolean;
  categories: { label: string; value: string }[];
  onClose: () => void;
  onSubmit: (payload: CommunityEventInput) => Promise<void>;
}

export default function SubmitEventModal({
  open,
  submitting,
  categories,
  onClose,
  onSubmit,
}: Props) {
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

    if (!form.virtual && !form.campusLocation.trim()) {
      setError('Campus location is required for in-person events');
      return;
    }

    const payload: CommunityEventInput = {
      club_name: form.clubName.trim(),
      event_name: form.eventName.trim(),
      event_category: form.eventCategory,
      date: form.date,
      start_time: form.startTime,
      end_time: form.endTime || undefined,
      campus_location: form.campusLocation.trim() || undefined,
      event_room: form.eventRoom.trim() || undefined,
      virtual: form.virtual,
      has_free_food: form.hasFreeFood,
      is_open_to_public: form.isOpenToPublic,
      event_link: form.eventLink.trim() || undefined,
      description: form.description.trim() || undefined,
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit event');
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(4, 7, 16, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120,
        padding: '24px',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: '88vh',
          overflowY: 'auto',
          backgroundColor: 'rgba(18, 23, 32, 0.98)',
          border: '1px solid var(--border-default)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 28px 90px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px', color: 'white', fontSize: '1.35rem', fontWeight: 800 }}>
              Submit an event
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Share an upcoming NJIT event so it appears in the campus feed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              alignSelf: 'flex-start',
              border: '1px solid var(--border-default)',
              backgroundColor: 'rgba(255,255,255,0.04)',
              color: 'var(--text-primary)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Club / Organization</span>
              <input
                value={form.clubName}
                onChange={(event) => setForm((prev) => ({ ...prev, clubName: event.target.value }))}
                placeholder="Women in Computing Society"
                required
                style={fieldStyle}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Event name</span>
              <input
                value={form.eventName}
                onChange={(event) => setForm((prev) => ({ ...prev, eventName: event.target.value }))}
                placeholder="Spring Industry Mixer"
                required
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Category</span>
              <select
                value={form.eventCategory}
                onChange={(event) => setForm((prev) => ({ ...prev, eventCategory: event.target.value }))}
                style={fieldStyle}
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                required
                style={fieldStyle}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Start time</span>
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                required
                style={fieldStyle}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>End time</span>
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>
                {form.virtual ? 'Virtual location' : 'Campus location'}
              </span>
              <input
                value={form.campusLocation}
                onChange={(event) => setForm((prev) => ({ ...prev, campusLocation: event.target.value }))}
                placeholder={form.virtual ? 'Zoom / Teams / Discord' : 'Campus Center'}
                required={!form.virtual}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Room</span>
              <input
                value={form.eventRoom}
                onChange={(event) => setForm((prev) => ({ ...prev, eventRoom: event.target.value }))}
                placeholder="Atrium / Room 112"
                style={fieldStyle}
              />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Event link</span>
            <input
              type="url"
              value={form.eventLink}
              onChange={(event) => setForm((prev) => ({ ...prev, eventLink: event.target.value }))}
              placeholder="https://example.com/rsvp"
              style={fieldStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Add the event details students should see in the modal."
              rows={5}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <label style={checkboxCardStyle}>
              <input
                type="checkbox"
                checked={form.virtual}
                onChange={(event) => setForm((prev) => ({ ...prev, virtual: event.target.checked }))}
              />
              <span>Virtual event</span>
            </label>
            <label style={checkboxCardStyle}>
              <input
                type="checkbox"
                checked={form.hasFreeFood}
                onChange={(event) => setForm((prev) => ({ ...prev, hasFreeFood: event.target.checked }))}
              />
              <span>Free food</span>
            </label>
            <label style={checkboxCardStyle}>
              <input
                type="checkbox"
                checked={form.isOpenToPublic}
                onChange={(event) => setForm((prev) => ({ ...prev, isOpenToPublic: event.target.checked }))}
              />
              <span>Open to public</span>
            </label>
          </div>

          {error && (
            <p
              style={{
                margin: 0,
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(243, 111, 111, 0.2)',
                backgroundColor: 'rgba(243, 111, 111, 0.1)',
                color: '#fecaca',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={primaryButtonStyle}>
              {submitting ? 'Submitting...' : 'Submit event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border-default)',
  backgroundColor: 'rgba(9, 12, 20, 0.96)',
  color: 'var(--text-primary)',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  outline: 'none',
};

const checkboxCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  border: '1px solid var(--border-default)',
  backgroundColor: 'rgba(255,255,255,0.03)',
  borderRadius: '14px',
  padding: '12px 14px',
  color: 'var(--text-secondary)',
  fontSize: '0.84rem',
  fontWeight: 600,
};

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid var(--border-default)',
  backgroundColor: 'rgba(255,255,255,0.04)',
  color: 'var(--text-primary)',
  borderRadius: '12px',
  padding: '11px 16px',
  fontSize: '0.84rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  background: 'linear-gradient(135deg, #d71920, #b70f16)',
  color: 'white',
  borderRadius: '12px',
  padding: '11px 16px',
  fontSize: '0.84rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 14px 30px rgba(183, 15, 22, 0.2)',
};
