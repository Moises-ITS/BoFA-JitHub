import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { clubNamesEquivalent, type ClubDirectoryEntry, getClubOptionLabel } from '../utils/clubMatching';

export interface CommunityEventInput {
  club_name: string;
  event_name: string;
  event_categories: string[];
  collaborators?: string[];
  corporate_partners?: string[];
  date: string;
  start_time: string;
  end_time?: string;
  campus_location?: string;
  event_room?: string;
  virtual: boolean;
  has_free_food: boolean;
  event_link?: string;
  description?: string;
}

const INITIAL_FORM = {
  clubName: '',
  eventName: '',
  eventCategories: ['workshop'],
  // Categories typed by the submitter that aren't in the fixed list. Held
  // separately from eventCategories so unchecking one can remove it from the
  // grid entirely — a preset merely unchecks, a custom one disappears.
  customCategories: [] as string[],
  collaborators: [] as string[],
  corporatePartners: [] as string[],
  date: '',
  startTime: '',
  endTime: '',
  campusLocation: '',
  eventRoom: '',
  virtual: false,
  hasFreeFood: false,
  eventLink: '',
  description: '',
};

interface Props {
  open: boolean;
  submitting: boolean;
  categories: { label: string; value: string }[];
  clubs: ClubDirectoryEntry[];
  onClose: () => void;
  onSubmit: (payload: CommunityEventInput) => Promise<void>;
}

export default function SubmitEventModal({
  open,
  submitting,
  categories,
  clubs,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [collaboratorDraft, setCollaboratorDraft] = useState('');
  const [corporatePartnerDraft, setCorporatePartnerDraft] = useState('');
  const [customCategoryDraft, setCustomCategoryDraft] = useState('');
  const selectedClub = clubs.find((club) => club.name === form.clubName) ?? null;

  // Preset categories plus anything the submitter typed, rendered as one grid so
  // a custom category is indistinguishable from a built-in once added.
  const presetValues = new Set(categories.map((category) => category.value));
  const categoryOptions = [
    ...categories.map((category) => ({ ...category, custom: false })),
    ...form.customCategories.map((label) => ({
      label,
      value: label.trim().toLowerCase(),
      custom: true,
    })),
  ];
  const availableCollaboratorOptions = clubs.filter((club) => (
    !clubNamesEquivalent(club.name, form.clubName)
    && !form.collaborators.some((collaborator) => clubNamesEquivalent(collaborator, club.name))
  ));

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setError(null);
      setCollaboratorDraft('');
      setCorporatePartnerDraft('');
      setCustomCategoryDraft('');
    }
  }, [open]);

  useEffect(() => {
    if (!form.clubName) return;
    setForm((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((collaborator) => !clubNamesEquivalent(collaborator, prev.clubName)),
    }));
  }, [form.clubName]);

  if (!open) return null;

  function addCollaborator() {
    const nextCollaborator = collaboratorDraft.trim();
    if (!nextCollaborator || clubNamesEquivalent(nextCollaborator, form.clubName)) {
      setCollaboratorDraft('');
      return;
    }
    if (form.collaborators.some((collaborator) => clubNamesEquivalent(collaborator, nextCollaborator))) {
      setCollaboratorDraft('');
      return;
    }
    setForm((prev) => ({
      ...prev,
      collaborators: [...prev.collaborators, nextCollaborator],
    }));
    setCollaboratorDraft('');
  }

  function addCustomCategory() {
    const label = customCategoryDraft.trim();
    if (!label) {
      setCustomCategoryDraft('');
      return;
    }
    const value = label.toLowerCase();

    // Typing the name of a preset just selects that preset instead of creating a
    // near-duplicate ("Workshop" alongside the built-in "workshop"), which would
    // otherwise split the same category into two on the events feed.
    if (presetValues.has(value)) {
      setForm((prev) => ({
        ...prev,
        eventCategories: prev.eventCategories.includes(value)
          ? prev.eventCategories
          : [...prev.eventCategories, value],
      }));
      setCustomCategoryDraft('');
      return;
    }

    if (form.customCategories.some((existing) => existing.trim().toLowerCase() === value)) {
      setCustomCategoryDraft('');
      return;
    }

    // Added categories are selected immediately — someone who took the trouble
    // to type one means it to apply.
    setForm((prev) => ({
      ...prev,
      customCategories: [...prev.customCategories, label],
      eventCategories: [...prev.eventCategories, value],
    }));
    setCustomCategoryDraft('');
  }

  function toggleCategory(value: string, checked: boolean, custom: boolean) {
    setForm((prev) => ({
      ...prev,
      eventCategories: checked
        ? [...prev.eventCategories, value]
        : prev.eventCategories.filter((existing) => existing !== value),
      // Unchecking a custom category removes it from the grid entirely; there is
      // no list to restore it from, so leaving an unchecked orphan chip behind
      // would be clutter the submitter cannot clear.
      customCategories: custom && !checked
        ? prev.customCategories.filter((label) => label.trim().toLowerCase() !== value)
        : prev.customCategories,
    }));
  }

  function addCorporatePartner() {
    const nextPartner = corporatePartnerDraft.trim();
    if (!nextPartner) {
      setCorporatePartnerDraft('');
      return;
    }
    if (form.corporatePartners.some((partner) => partner.toLowerCase() === nextPartner.toLowerCase())) {
      setCorporatePartnerDraft('');
      return;
    }
    setForm((prev) => ({
      ...prev,
      corporatePartners: [...prev.corporatePartners, nextPartner],
    }));
    setCorporatePartnerDraft('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (form.eventCategories.length === 0) {
      setError('Pick at least one event category');
      return;
    }

    if (!form.virtual && !form.campusLocation.trim()) {
      setError('Campus location is required for in-person events');
      return;
    }

    const payload: CommunityEventInput = {
      club_name: form.clubName.trim(),
      event_name: form.eventName.trim(),
      event_categories: form.eventCategories,
      collaborators: form.collaborators,
      corporate_partners: form.corporatePartners,
      date: form.date,
      start_time: form.startTime,
      end_time: form.endTime || undefined,
      // A virtual event has no campus location or room. The inputs are hidden
      // rather than cleared so unchecking "Virtual event" restores whatever was
      // already typed — which means their values must be dropped HERE, or a
      // stale in-person location would ride along on a virtual submission.
      campus_location: form.virtual ? undefined : form.campusLocation.trim() || undefined,
      event_room: form.virtual ? undefined : form.eventRoom.trim() || undefined,
      virtual: form.virtual,
      has_free_food: form.hasFreeFood,
      // is_open_to_public is no longer collected. The API defaults it to true
      // (see EDEN routers/events.py), so omitting it keeps every submission
      // public without asking a question nobody was answering meaningfully.
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
              {clubs.length > 0 ? (
                <select
                  value={form.clubName}
                  onChange={(event) => setForm((prev) => ({ ...prev, clubName: event.target.value }))}
                  required
                  style={fieldStyle}
                >
                  <option value="">Select a club</option>
                  {clubs.map((club) => (
                    <option key={club.club_id} value={club.name}>
                      {getClubOptionLabel(club)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.clubName}
                  onChange={(event) => setForm((prev) => ({ ...prev, clubName: event.target.value }))}
                  placeholder="Women in Computer Science"
                  required
                  style={fieldStyle}
                />
              )}
              <span style={helperTextStyle}>
                {selectedClub
                  ? `This event will reuse ${selectedClub.display_name}'s saved logo.`
                  : 'Pick a known club to reuse its saved logo automatically.'}
              </span>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Collaborating clubs</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                <select
                  value={collaboratorDraft}
                  onChange={(event) => setCollaboratorDraft(event.target.value)}
                  style={{ ...fieldStyle, flex: 1 }}
                >
                  <option value="">Optional</option>
                  {availableCollaboratorOptions.map((club) => (
                    <option key={club.club_id} value={club.name}>
                      {getClubOptionLabel(club)}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addCollaborator} style={secondaryButtonStyle}>
                  Add
                </button>
              </div>
              {form.collaborators.length > 0 && (
                <div style={pillWrapStyle}>
                  {form.collaborators.map((collaborator) => (
                    <button
                      key={collaborator}
                      type="button"
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        collaborators: prev.collaborators.filter((value) => !clubNamesEquivalent(value, collaborator)),
                      }))}
                      style={pillStyle}
                    >
                      {clubs.find((club) => clubNamesEquivalent(club.name, collaborator))
                        ? getClubOptionLabel(clubs.find((club) => clubNamesEquivalent(club.name, collaborator))!)
                        : collaborator}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}
              <span style={helperTextStyle}>
                Optional. Pick any NJIT club collaborating on this event.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Corporate partners</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                <input
                  value={corporatePartnerDraft}
                  onChange={(event) => setCorporatePartnerDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addCorporatePartner();
                    }
                  }}
                  placeholder="Optional company or sponsor"
                  style={{ ...fieldStyle, flex: 1 }}
                />
                <button type="button" onClick={addCorporatePartner} style={secondaryButtonStyle}>
                  Add
                </button>
              </div>
              {form.corporatePartners.length > 0 && (
                <div style={pillWrapStyle}>
                  {form.corporatePartners.map((partner) => (
                    <button
                      key={partner}
                      type="button"
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        corporatePartners: prev.corporatePartners.filter((value) => value.toLowerCase() !== partner.toLowerCase()),
                      }))}
                      style={pillStyle}
                    >
                      {partner}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}
              <span style={helperTextStyle}>
                Optional. Type any company name exactly how you want it shown.
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Categories</span>
            <div style={categoryGridStyle}>
              {categoryOptions.map((category) => {
                const checked = form.eventCategories.includes(category.value);
                return (
                  <label
                    key={`${category.custom ? 'custom' : 'preset'}:${category.value}`}
                    style={checked ? checkedCategoryChipStyle : categoryChipStyle}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleCategory(category.value, event.target.checked, category.custom)}
                      style={{ margin: 0 }}
                    />
                    <span>{category.label}</span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
              <input
                value={customCategoryDraft}
                onChange={(event) => setCustomCategoryDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Enter inside a form submits it by default; this field adds a
                  // category instead, so the modal cannot be submitted early by
                  // someone finishing a word.
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomCategory();
                  }
                }}
                placeholder="Custom category"
                style={{ ...fieldStyle, flex: 1 }}
              />
              <button type="button" onClick={addCustomCategory} style={secondaryButtonStyle}>
                Add
              </button>
            </div>

            <span style={helperTextStyle}>
              Select every category that fits this event, or add your own if none apply.
            </span>
          </div>

          {/*
            Hidden outright for virtual events rather than relabelled — a virtual
            event has no campus location or room, so asking for them invites
            confusion. State is intentionally NOT cleared: unchecking "Virtual
            event" brings the fields back with whatever was already typed. The
            values are dropped at submit time instead (see handleSubmit).
          */}
          {!form.virtual && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>Campus location</span>
                <input
                  value={form.campusLocation}
                  onChange={(event) => setForm((prev) => ({ ...prev, campusLocation: event.target.value }))}
                  placeholder="Campus Center"
                  required
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
          )}

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
              style={{ ...fieldStyle, resize: 'vertical', maxHeight: '220px', overflowY: 'auto' }}
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

const helperTextStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.74rem',
  lineHeight: 1.5,
};

const pillWrapStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
};

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  border: '1px solid rgba(215, 25, 32, 0.24)',
  backgroundColor: 'rgba(215, 25, 32, 0.12)',
  color: '#ffe7e8',
  borderRadius: '999px',
  padding: '8px 12px',
  fontSize: '0.78rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const categoryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '10px',
};

const categoryChipStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  border: '1px solid var(--border-default)',
  backgroundColor: 'rgba(255,255,255,0.03)',
  borderRadius: '14px',
  padding: '12px 14px',
  color: 'var(--text-secondary)',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const checkedCategoryChipStyle: CSSProperties = {
  ...categoryChipStyle,
  border: '1px solid rgba(215, 25, 32, 0.32)',
  backgroundColor: 'rgba(215, 25, 32, 0.12)',
  color: '#ffe7e8',
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
