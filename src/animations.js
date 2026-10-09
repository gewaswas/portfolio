import { useEffect, useRef, useState } from 'react';
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}
export function useVisible() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}
export function useTypedName(name, speed, enabled) {
  const [text, setText] = useState(enabled ? '' : name);
  useEffect(() => {
    if (!enabled) {
      setText(name);
      return;
    }
    setText('');
    let index = 0;
    const timer = setInterval(() => {
      index++;
      setText(name.slice(0, index));
      if (index >= name.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [name, speed, enabled]);
  return text;
}
export function useTypedRoles(roles, speed, enabled) {
  const [text, setText] = useState(roles[0]);
  const key = roles.join('\u0000');
  useEffect(() => {
    if (!enabled) {
      setText(roles[0]);
      return;
    }
    let role = 0,
      length = 0,
      deleting = false,
      timer;
    setText('');
    const tick = () => {
      const word = roles[role];
      length += deleting ? -1 : 1;
      setText(word.slice(0, Math.max(0, length)));
      let delay = deleting ? speed * 0.5 : speed;
      if (!deleting && length === word.length) {
        deleting = true;
        delay = 1600;
      } else if (deleting && length === 0) {
        deleting = false;
        role = (role + 1) % roles.length;
        delay = 350;
      }
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [key, speed, enabled]);
  return text;
}
