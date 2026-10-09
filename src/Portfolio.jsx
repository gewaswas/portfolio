import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useReducedMotion, useTypedName, useTypedRoles, useVisible } from './animations.js';

function InstagramIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" />
    </svg>
  );
}
function Image({ src, alt, className = '', fallback }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  ) : (
    <div
      className={`${className} image-fallback`}
      role="img"
      aria-label={`${alt} — image not yet added`}
    >
      {fallback || <span>KBD.</span>}
    </div>
  );
}
function Reveal({ children, enabled, className = '' }) {
  const [ref, visible] = useVisible();
  return (
    <div
      ref={ref}
      className={`${className} ${enabled ? 'reveal' : ''} ${visible ? 'visible' : ''}`}
    >
      {children}
    </div>
  );
}
function Skill({ skill, enabled, duration }) {
  const [ref, visible] = useVisible();
  const [value, setValue] = useState(enabled ? 0 : skill.percent);
  useEffect(() => {
    if (!enabled) {
      setValue(skill.percent);
      return;
    }
    if (!visible) return;
    let frame, start;
    const animate = (time) => {
      start ??= time;
      const progress = Math.min((time - start) / duration, 1);
      setValue(Math.round(skill.percent * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [visible, enabled, skill.percent, duration]);
  return (
    <div ref={ref} className="skill">
      <div className="skill-ring" role="img" aria-label={`${skill.name}: ${skill.percent}%`}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="ring-track" cx="60" cy="60" r="51" />
          <circle
            className="ring-progress"
            cx="60"
            cy="60"
            r="51"
            pathLength="100"
            strokeDasharray={`${value} 100`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <span aria-hidden="true">{value}%</span>
      </div>
      <p>
        {skill.name}
        <small>{skill.subtitle}</small>
      </p>
    </div>
  );
}
function Software({ item, index, enabled }) {
  const [ref, visible] = useVisible();
  const [showIcon, setShowIcon] = useState(false);
  useEffect(() => {
    if (!enabled || !visible || !item.icon) return;
    const timer = setInterval(() => setShowIcon((value) => !value), 3500);
    return () => clearInterval(timer);
  }, [enabled, visible, item.icon]);
  return (
    <article ref={ref} className={`software-card ${index % 2 ? 'reverse' : ''}`}>
      <div className="software-copy">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
      </div>
      <div className={`software-visual ${showIcon ? 'show-icon' : ''}`}>
        <Image
          src={item.image}
          alt={`${item.name} workspace`}
          className="software-shot"
          fallback={
            <span className="software-placeholder">
              {item.name === 'FIGMA' ? 'Design.' : '</>'}
            </span>
          }
        />
        {item.icon && <Image src={item.icon} alt={`${item.name} icon`} className="software-icon" />}
      </div>
    </article>
  );
}
function ProjectDialog({ project, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = old;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="project-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="project-dialog-title"
    >
      <button className="dialog-close" aria-label="Close project" onClick={onClose}>
        ×
      </button>
      <Image
        src={project.image}
        alt={`${project.name} logo`}
        className="dialog-project-image"
        fallback={<span>{project.name}</span>}
      />
      <h2 id="project-dialog-title">{project.name}</h2>
      <p>{project.description}</p>
      <div className="project-actions">
        {project.url && (
          <a href={project.url} target="_blank" rel="noopener noreferrer">
            Visit project ↗
          </a>
        )}
        {project.github && (
          <a href={project.github} target="_blank" rel="noopener noreferrer">
            Source code ↗
          </a>
        )}
      </div>
    </dialog>
  );
}
export function PortfolioView({ content: c }) {
  const reduced = useReducedMotion();
  const enabled = c.animations.enabled && !reduced;
  const name = useTypedName(c.name, c.animations.typingSpeed, enabled);
  const role = useTypedRoles(c.roles, c.animations.typingSpeed, enabled);
  const [menu, setMenu] = useState(false);
  const [project, setProject] = useState(null);
  useEffect(() => {
    document.title = `${c.brand} — ${c.name}`;
  }, [c.brand, c.name]);
  return (
    <div className={`portfolio ${enabled ? 'motion-on' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header wrap">
        <a className="brand" href="#home" aria-label="Home">
          {c.brand}
        </a>
        <button
          className="menu-toggle"
          aria-label={menu ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menu}
          aria-controls="navigation"
          onClick={() => setMenu(!menu)}
        >
          {menu ? '×' : '☰'}
        </button>
        <nav id="navigation" className={menu ? 'open' : ''} aria-label="Main navigation">
          {[
            ['About', 'about'],
            ['Skills', 'skills'],
            ['Projects', 'projects'],
            ['Contact', 'contact'],
          ].map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
          <a className="nav-email" href={`mailto:${c.email}`}>
            {c.email}
          </a>
        </nav>
      </header>
      <main id="main">
        <section className="hero wrap" id="home" aria-label="Introduction">
          <div className="hero-copy">
            <p className="greeting">{c.greeting}</p>
            <h1 aria-label={c.name}>
              <span aria-hidden="true">
                {name}
                <span className={`type-caret ${name === c.name ? 'finished' : ''}`} />
              </span>
            </h1>
            <p className="intro">{c.intro}</p>
            <p className="role-line">
              Passionate in{' '}
              <span className="typed-role" aria-label={c.roles.join(' and ')}>
                <span aria-hidden="true">
                  {role}
                  <span className="type-caret" />
                </span>
              </span>
            </p>
            {c.resume && (
              <a className="resume-link" href={c.resume} target="_blank" rel="noopener noreferrer">
                Résumé <span>↗</span>
              </a>
            )}
          </div>
          <div className="hero-portrait">
            <Image
              src={c.heroImage}
              alt={`${c.name}, casual portrait`}
              className="portrait"
              fallback={
                <span className="portrait-monogram">
                  K<span>B</span>D.
                </span>
              }
            />
          </div>
        </section>
        <div className="gradient-area">
          <section id="about" className="about wrap" aria-labelledby="about-heading">
            <Reveal enabled={enabled} className="about-portrait">
              <Image
                src={c.aboutImage}
                alt={`${c.name}, formal portrait`}
                className="portrait"
                fallback={<span className="portrait-monogram">K.</span>}
              />
            </Reveal>
            <Reveal enabled={enabled} className="about-copy">
              <h2 id="about-heading">{c.aboutTitle}</h2>
              {c.aboutParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </Reveal>
          </section>
          <section id="projects" className="projects wrap" aria-labelledby="projects-heading">
            <Reveal enabled={enabled}>
              <h2 id="projects-heading">{c.projectsTitle}</h2>
            </Reveal>
            <div className="project-grid">
              {c.projects.map((p) => (
                <Reveal enabled={enabled} key={p.id}>
                  <button
                    className="project-card"
                    onClick={() => setProject(p)}
                    aria-label={`View ${p.name}`}
                  >
                    <div className="project-logo">
                      <Image
                        src={p.image}
                        alt={`${p.name} logo`}
                        fallback={
                          <span className={`project-wordmark wordmark-${p.id}`}>{p.name}</span>
                        }
                      />
                    </div>
                    <span className="project-name">{p.name}</span>
                  </button>
                </Reveal>
              ))}
            </div>
          </section>
          <section id="skills" className="skills wrap" aria-labelledby="skills-heading">
            <h2 id="skills-heading">{c.skillsTitle}</h2>
            <div className="skills-grid">
              {c.skills.map((s) => (
                <Skill
                  key={s.id}
                  skill={s}
                  enabled={enabled}
                  duration={c.animations.ringDuration}
                />
              ))}
            </div>
          </section>
          <section id="software" className="software wrap" aria-labelledby="software-heading">
            <h2 id="software-heading">{c.softwareTitle}</h2>
            <div className="software-list">
              {c.software.map((s, i) => (
                <Reveal enabled={enabled} key={s.id}>
                  <Software item={s} index={i} enabled={enabled} />
                </Reveal>
              ))}
            </div>
          </section>
        </div>
        <section id="contact" className="contact wrap" aria-labelledby="contact-heading">
          <h2 id="contact-heading">{c.contactTitle}</h2>
          <div className="contact-links">
            <a href={`mailto:${c.email}`}>{c.email}</a>
            {c.instagram && (
              <a href={c.instagram} target="_blank" rel="noopener noreferrer">
                <InstagramIcon /> Instagram
              </a>
            )}
            {c.github && (
              <a href={c.github} target="_blank" rel="noopener noreferrer">
                GitHub <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </section>
      </main>
      <footer className="footer wrap">
        <div className="footer-line">
          <a href="#home" className="brand">
            {c.brand}
          </a>
          <p>
            © {new Date().getFullYear()} {c.copyright}
          </p>
        </div>
        <p className="footer-thanks">
          Thanks for the visit <span aria-hidden="true">♧</span>
        </p>
        <a className="editor-link" href="/admin" aria-label="Edit portfolio">
          {c.brand}
        </a>
      </footer>
      {project && <ProjectDialog project={project} onClose={() => setProject(null)} />}
    </div>
  );
}
export function Portfolio() {
  const [record, setRecord] = useState(null),
    [error, setError] = useState('');
  const load = () => {
    setError('');
    api('/content')
      .then(setRecord)
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);
  if (error)
    return (
      <main className="app-message">
        <span className="brand">KBD.</span>
        <h1>Portfolio unavailable</h1>
        <p>{error}</p>
        <button onClick={load}>Try again</button>
      </main>
    );
  if (!record)
    return (
      <main className="app-message" aria-busy="true">
        <span className="brand loading-brand">KBD.</span>
        <p>Loading portfolio…</p>
      </main>
    );
  return <PortfolioView content={record.content} />;
}
