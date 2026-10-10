import { useEffect, useId, useRef, useState } from 'react';
import { api } from './api.js';
import { contentSchema } from '../shared/content.js';
import { PortfolioView } from './Portfolio.jsx';

function Field({ label, value, onChange, multiline = false, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          {...props}
        />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
      )}
    </div>
  );
}
function AssetField({ label, value, onChange, pdf = false, assets, onError }) {
  const [uploading, setUploading] = useState(false);
  const input = useRef(null);
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      onError('File must be under 8 MB.');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await api('/uploads', { method: 'POST', body });
      onChange(result.url);
    } catch (error) {
      onError(error.message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="asset-field">
      <Field
        label={label}
        value={value}
        onChange={onChange}
        placeholder={pdf ? 'Upload your résumé PDF' : 'Upload an image or enter its URL'}
      />
      <div className="asset-controls">
        <label className={`button secondary upload-button ${uploading ? 'disabled' : ''}`}>
          {uploading ? 'Uploading…' : pdf ? 'Upload PDF' : 'Upload image'}
          <input
            ref={input}
            type="file"
            accept={pdf ? 'application/pdf' : 'image/png,image/jpeg,image/webp,image/gif'}
            onChange={upload}
            disabled={uploading}
          />
        </label>
        {!pdf && assets.length > 0 && (
          <select
            aria-label={`Choose local file for ${label}`}
            value=""
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="" disabled>
              Choose local image…
            </option>
            {assets.map((a) => (
              <option key={a} value={a}>
                {a.split('/').pop()}
              </option>
            ))}
          </select>
        )}
        {value && (
          <button type="button" className="text-button" onClick={() => onChange('')}>
            Remove
          </button>
        )}
      </div>
      {value && !pdf && <img src={value} alt={`${label} preview`} className="asset-preview" />}
    </div>
  );
}
function DraftPreview({ content, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="draft-preview"
      onCancel={onClose}
      aria-label="Draft portfolio preview"
    >
      <div className="preview-toolbar">
        <span>Draft preview · Changes have not been saved</span>
        <button onClick={onClose}>Back to editor</button>
      </div>
      <PortfolioView content={content} />
    </dialog>
  );
}
const tabs = ['Profile', 'Projects', 'Skills', 'Software', 'Contact', 'Animation'];
export function Admin() {
  const [session, setSession] = useState(null),
    [checking, setChecking] = useState(true);
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [record, setRecord] = useState(null),
    [draft, setDraft] = useState(null),
    [assets, setAssets] = useState([]);
  const [tab, setTab] = useState('Profile'),
    [preview, setPreview] = useState(false);
  const latestDraft = useRef(draft);
  useEffect(() => {
    latestDraft.current = draft;
  }, [draft]);
  const dirty = !!record && JSON.stringify(record.content) !== JSON.stringify(draft);
  const load = async () => {
    const [content, assetList] = await Promise.all([api('/content'), api('/assets')]);
    setRecord(content);
    setDraft(content.content);
    setAssets(assetList);
  };
  useEffect(() => {
    document.title = 'Edit portfolio — KBD.';
    api('/auth/session')
      .then(async (s) => {
        setSession(s);
        await load();
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    const warn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const update = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setNotice('');
  };
  const updateItem = (key, index, field, value) =>
    update(
      key,
      draft[key].map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  const move = (key, index, direction) => {
    const next = [...draft[key]];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    update(key, next);
  };
  const remove = (key, index) =>
    update(
      key,
      draft[key].filter((_, i) => i !== index),
    );
  const fail = (e) => {
    setError(typeof e === 'string' ? e : e.message);
    if (e.status === 401) setSession(null);
  };
  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword('');
      setSession(await api('/auth/session'));
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const validate = () => {
    const result = contentSchema.safeParse(draft);
    if (!result.success) {
      const issue = result.error.issues[0];
      setError(`${issue.path.join(' → ')}: ${issue.message}`);
      return false;
    }
    return true;
  };
  const save = async () => {
    setError('');
    if (!validate()) return;
    const submittedDraft = draft;
    setBusy(true);
    try {
      const next = await api('/content', {
        method: 'PUT',
        body: JSON.stringify({ content: draft, revision: record.revision }),
      });
      setRecord(next);
      setDraft((current) => (current === submittedDraft ? next.content : current));
      setNotice(
        latestDraft.current === submittedDraft
          ? 'Changes saved. Your portfolio is up to date.'
          : 'Changes saved. Your newer edits are still unsaved.',
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    if (dirty && !window.confirm('Discard unsaved changes and sign out?')) return;
    try {
      await api('/auth/logout', { method: 'POST' });
      setSession(null);
      setRecord(null);
      setDraft(null);
    } catch (e) {
      fail(e);
    }
  };
  const exportBackup = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'kbd-portfolio-backup.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Backup must be under 1 MB.');
      const imported = contentSchema.parse(JSON.parse(await file.text()));
      if (!dirty || window.confirm('Replace your unsaved draft with this backup?')) {
        setDraft(imported);
        setNotice('Backup loaded into draft. Save to publish it.');
      }
    } catch {
      setError('This file is not a valid portfolio backup.');
    } finally {
      event.target.value = '';
    }
  };
  const assetProps = { assets, onError: fail };
  const rowActions = (key, index) => (
    <div className="row-actions">
      <button
        className="text-button"
        aria-label={`Move ${key} item ${index + 1} up`}
        disabled={index === 0}
        onClick={() => move(key, index, -1)}
      >
        ↑
      </button>
      <button
        className="text-button"
        aria-label={`Move ${key} item ${index + 1} down`}
        disabled={index === draft[key].length - 1}
        onClick={() => move(key, index, 1)}
      >
        ↓
      </button>
      <button className="text-button danger" onClick={() => remove(key, index)}>
        Delete
      </button>
    </div>
  );
  if (checking)
    return (
      <main className="app-message">
        <span className="brand">KBD.</span>
        <p>Opening editor…</p>
      </main>
    );
  if (!session)
    return (
      <main className="admin-login">
        <a href="/" className="brand">
          KBD.
        </a>
        <form onSubmit={login} className="login-card">
          <span className="admin-eyebrow">YOUR SPACE</span>
          <h1>Edit your portfolio.</h1>
          <p>Sign in to update your content, images, and animations.</p>
          <Field
            label="Admin password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in →'}
          </button>
          <a href="/" className="login-back">
            ← Back to portfolio
          </a>
        </form>
      </main>
    );
  if (!draft)
    return (
      <main className="app-message">
        <p>{error || 'Loading your content…'}</p>
        <button onClick={() => load().catch(fail)}>Retry</button>
      </main>
    );
  return (
    <div className="admin">
      <header className="admin-header">
        <div>
          <a href="/" className="brand">
            KBD.
          </a>
          <span className="admin-header-label">PORTFOLIO EDITOR</span>
        </div>
        <div className="admin-top-actions">
          <span className={`save-state ${dirty ? 'unsaved' : ''}`}>
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <button
            className="button secondary"
            onClick={() => {
              if (validate()) setPreview(true);
            }}
          >
            Preview
          </button>
          <button className="button primary" onClick={save} disabled={!dirty || busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <nav aria-label="Editor sections">
            {tabs.map((t) => (
              <button
                key={t}
                className={t === tab ? 'active' : ''}
                onClick={() => {
                  setTab(t);
                  setError('');
                }}
              >
                {t}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <a href="/" target="_blank" rel="noopener noreferrer">
              View live portfolio ↗
            </a>
            <button onClick={exportBackup}>Export backup ↓</button>
            <label className="import-backup">
              Import backup ↑
              <input type="file" accept="application/json,.json" onChange={importBackup} />
            </label>
            <button onClick={logout} disabled={busy}>
              Sign out
            </button>
            <small>
              {session.storage === 'mongodb' ? 'Connected to MongoDB' : 'Local development storage'}
            </small>
          </div>
        </aside>
        <main className="admin-main">
          <div className="editor-heading">
            <span className="admin-eyebrow">MAKE IT YOURS</span>
            <h1>{tab}</h1>
            <p>
              {
                {
                  Profile: 'Your introduction, portraits, and about section.',
                  Projects: 'Show the work you’re proud of. Visitors can open each project.',
                  Skills: 'Set the skills and percentages shown in your animated rings.',
                  Software: 'Add your tools, workspace images, and animated icon images.',
                  Contact: 'Give visitors a way to reach you.',
                  Animation: 'Adjust the typewriter and progress animation to your taste.',
                }[tab]
              }
            </p>
          </div>
          {error && (
            <div role="alert" className="error-message editor-message">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="success-message editor-message">
              {notice}
            </div>
          )}
          {tab === 'Profile' && (
            <>
              <section className="editor-section">
                <h2>Introduction</h2>
                <div className="field-grid">
                  <Field label="Brand" value={draft.brand} onChange={(v) => update('brand', v)} />
                  <Field label="Your name" value={draft.name} onChange={(v) => update('name', v)} />
                  <Field
                    label="Greeting"
                    value={draft.greeting}
                    onChange={(v) => update('greeting', v)}
                  />
                  <Field
                    label="Introduction"
                    value={draft.intro}
                    onChange={(v) => update('intro', v)}
                  />
                </div>
                <Field
                  label="Typing words (one per line)"
                  value={draft.roles.join('\n')}
                  multiline
                  onChange={(v) => update('roles', v.split('\n'))}
                />
                <div className="field-grid">
                  <AssetField
                    label="Hero portrait"
                    value={draft.heroImage}
                    onChange={(v) => update('heroImage', v)}
                    {...assetProps}
                  />
                  <AssetField
                    label="About portrait"
                    value={draft.aboutImage}
                    onChange={(v) => update('aboutImage', v)}
                    {...assetProps}
                  />
                </div>
                <AssetField
                  label="Résumé (optional)"
                  pdf
                  value={draft.resume}
                  onChange={(v) => update('resume', v)}
                  {...assetProps}
                />
              </section>
              <section className="editor-section">
                <h2>About you</h2>
                <Field
                  label="About section heading"
                  value={draft.aboutTitle}
                  onChange={(v) => update('aboutTitle', v)}
                />
                {draft.aboutParagraphs.map((p, i) => (
                  <div key={i} className="paragraph-row">
                    <Field
                      label={`Paragraph ${i + 1}`}
                      value={p}
                      multiline
                      onChange={(v) =>
                        update(
                          'aboutParagraphs',
                          draft.aboutParagraphs.map((item, j) => (j === i ? v : item)),
                        )
                      }
                    />
                    {draft.aboutParagraphs.length > 1 && (
                      <button
                        className="text-button danger"
                        onClick={() =>
                          update(
                            'aboutParagraphs',
                            draft.aboutParagraphs.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Delete paragraph
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="button secondary"
                  disabled={draft.aboutParagraphs.length >= 8}
                  onClick={() => update('aboutParagraphs', [...draft.aboutParagraphs, ''])}
                >
                  + Add paragraph
                </button>
              </section>
            </>
          )}
          {tab === 'Projects' && (
            <>
              <Field
                label="Projects section heading"
                value={draft.projectsTitle}
                onChange={(v) => update('projectsTitle', v)}
              />
              {draft.projects.map((p, i) => (
                <section key={p.id} className="editor-section">
                  <div className="editor-row-heading">
                    <h2>Project {i + 1}</h2>
                    {rowActions('projects', i)}
                  </div>
                  <Field
                    label="Project name"
                    value={p.name}
                    onChange={(v) => updateItem('projects', i, 'name', v)}
                  />
                  <AssetField
                    label="Project logo"
                    value={p.image}
                    onChange={(v) => updateItem('projects', i, 'image', v)}
                    {...assetProps}
                  />
                  <Field
                    label="Description"
                    value={p.description}
                    multiline
                    onChange={(v) => updateItem('projects', i, 'description', v)}
                  />
                  <div className="field-grid">
                    <Field
                      label="Live project URL (optional)"
                      value={p.url}
                      type="url"
                      placeholder="https://…"
                      onChange={(v) => updateItem('projects', i, 'url', v)}
                    />
                    <Field
                      label="Source code URL (optional)"
                      value={p.github}
                      type="url"
                      placeholder="https://github.com/…"
                      onChange={(v) => updateItem('projects', i, 'github', v)}
                    />
                  </div>
                </section>
              ))}
              <button
                className="button secondary"
                disabled={draft.projects.length >= 12}
                onClick={() =>
                  update('projects', [
                    ...draft.projects,
                    {
                      id: crypto.randomUUID(),
                      name: 'New project',
                      image: '',
                      description: '',
                      url: '',
                      github: '',
                    },
                  ])
                }
              >
                + Add project
              </button>
            </>
          )}
          {tab === 'Skills' && (
            <>
              <Field
                label="Skills section heading"
                value={draft.skillsTitle}
                onChange={(v) => update('skillsTitle', v)}
              />
              {draft.skills.map((s, i) => (
                <section className="editor-section" key={s.id}>
                  <div className="editor-row-heading">
                    <h2>Skill {i + 1}</h2>
                    {rowActions('skills', i)}
                  </div>
                  <div className="field-grid">
                    <Field
                      label="Skill name"
                      value={s.name}
                      onChange={(v) => updateItem('skills', i, 'name', v)}
                    />
                    <Field
                      label="Subtitle"
                      value={s.subtitle}
                      onChange={(v) => updateItem('skills', i, 'subtitle', v)}
                    />
                  </div>
                  <Field
                    label="Proficiency (%)"
                    type="number"
                    min="0"
                    max="100"
                    value={s.percent}
                    onChange={(v) => updateItem('skills', i, 'percent', Number(v))}
                  />
                  <div className="editor-progress">
                    <span style={{ width: `${s.percent}%` }} />
                  </div>
                </section>
              ))}
              <button
                className="button secondary"
                disabled={draft.skills.length >= 12}
                onClick={() =>
                  update('skills', [
                    ...draft.skills,
                    {
                      id: crypto.randomUUID(),
                      name: 'New skill',
                      subtitle: 'Programming',
                      percent: 50,
                    },
                  ])
                }
              >
                + Add skill
              </button>
            </>
          )}
          {tab === 'Software' && (
            <>
              <Field
                label="Software section heading"
                value={draft.softwareTitle}
                onChange={(v) => update('softwareTitle', v)}
              />
              {draft.software.map((s, i) => (
                <section key={s.id} className="editor-section">
                  <div className="editor-row-heading">
                    <h2>Tool {i + 1}</h2>
                    {rowActions('software', i)}
                  </div>
                  <Field
                    label="Software name"
                    value={s.name}
                    onChange={(v) => updateItem('software', i, 'name', v)}
                  />
                  <Field
                    label="How you use it"
                    value={s.description}
                    multiline
                    onChange={(v) => updateItem('software', i, 'description', v)}
                  />
                  <div className="field-grid">
                    <AssetField
                      label="Workspace screenshot"
                      value={s.image}
                      onChange={(v) => updateItem('software', i, 'image', v)}
                      {...assetProps}
                    />
                    <AssetField
                      label="Icon image (crossfades with screenshot)"
                      value={s.icon}
                      onChange={(v) => updateItem('software', i, 'icon', v)}
                      {...assetProps}
                    />
                  </div>
                </section>
              ))}
              <button
                className="button secondary"
                disabled={draft.software.length >= 12}
                onClick={() =>
                  update('software', [
                    ...draft.software,
                    {
                      id: crypto.randomUUID(),
                      name: 'New tool',
                      description: '',
                      image: '',
                      icon: '',
                    },
                  ])
                }
              >
                + Add software
              </button>
            </>
          )}
          {tab === 'Contact' && (
            <section className="editor-section">
              <Field
                label="Contact section heading"
                value={draft.contactTitle}
                onChange={(v) => update('contactTitle', v)}
              />
              <Field
                label="Email"
                value={draft.email}
                type="email"
                onChange={(v) => update('email', v)}
              />
              <Field
                label="Instagram profile URL (optional)"
                value={draft.instagram}
                type="url"
                placeholder="https://instagram.com/yourusername"
                onChange={(v) => update('instagram', v)}
              />
              <Field
                label="GitHub profile URL (optional)"
                value={draft.github ?? ''}
                type="url"
                placeholder="https://github.com/yourusername"
                onChange={(v) => update('github', v)}
              />
              <Field
                label="Copyright message"
                value={draft.copyright}
                onChange={(v) => update('copyright', v)}
              />
            </section>
          )}
          {tab === 'Animation' && (
            <section className="editor-section">
              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={draft.animations.enabled}
                  onChange={(e) =>
                    update('animations', { ...draft.animations, enabled: e.target.checked })
                  }
                />
                <span>Enable animations</span>
              </label>
              <p className="field-hint">
                Visitors who prefer reduced motion will see static text and percentages.
              </p>
              <Field
                label="Typing speed (milliseconds per character)"
                type="number"
                min="25"
                max="250"
                value={draft.animations.typingSpeed}
                onChange={(v) =>
                  update('animations', { ...draft.animations, typingSpeed: Number(v) })
                }
              />
              <Field
                label="Skill ring duration (milliseconds)"
                type="number"
                min="300"
                max="5000"
                value={draft.animations.ringDuration}
                onChange={(v) =>
                  update('animations', { ...draft.animations, ringDuration: Number(v) })
                }
              />
              <p className="field-hint">
                Lower typing values type faster. Longer ring durations animate more slowly. Software
                images crossfade every 3.5 seconds.
              </p>
            </section>
          )}
        </main>
      </div>
      {preview && <DraftPreview content={draft} onClose={() => setPreview(false)} />}
    </div>
  );
}
