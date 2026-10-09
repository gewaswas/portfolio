import { z } from 'zod';
const short = z.string().trim().max(200);
const body = z.string().trim().max(5000);
const link = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), 'Use a full http:// or https:// URL');
const asset = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (v) => !v || /^\/(?!\/)[\w\-./% ()]+$/.test(v) || /^https?:\/\/[^\s]+$/i.test(v),
    'Use an uploaded file, a local /assets path, or an HTTPS URL',
  );
export const contentSchema = z.object({
  brand: short.min(1),
  name: short.min(1),
  greeting: short.min(1),
  intro: short,
  roles: z.array(short.min(1)).min(1).max(8),
  heroImage: asset,
  aboutImage: asset,
  aboutTitle: short.min(1),
  aboutParagraphs: z.array(body).min(1).max(8),
  email: z.email(),
  instagram: link,
  github: link.default(''),
  resume: asset,
  projectsTitle: short.min(1),
  skillsTitle: short.min(1),
  softwareTitle: short.min(1),
  contactTitle: short.min(1),
  projects: z
    .array(
      z.object({
        id: short.min(1),
        name: short.min(1),
        image: asset,
        description: body,
        url: link,
        github: link,
      }),
    )
    .max(12),
  skills: z
    .array(
      z.object({
        id: short.min(1),
        name: short.min(1),
        subtitle: short,
        percent: z.number().min(0).max(100),
      }),
    )
    .max(12),
  software: z
    .array(
      z.object({
        id: short.min(1),
        name: short.min(1),
        description: body,
        image: asset,
        icon: asset,
      }),
    )
    .max(12),
  animations: z.object({
    enabled: z.boolean(),
    typingSpeed: z.number().min(25).max(250),
    ringDuration: z.number().min(300).max(5000),
  }),
  copyright: short,
});
export const defaultContent = {
  brand: 'KBD.',
  name: 'KYLE BRYAN DAVID',
  greeting: 'Hello, It’s Me',
  intro: 'I’m an IT Student, Who is',
  roles: ['Programming', 'Cybersecurity'],
  heroImage: '',
  aboutImage: '',
  aboutTitle: 'ABOUT',
  aboutParagraphs: [
    'Hi. I am Kyle Bryan David. I am a hard-working IT student specialized in UI/UX.',
    'Along with my degree, I completed Python, Java, SQL courses and various technologies.',
  ],
  email: 'kylbryandavid5@gmail.com',
  instagram: '',
  github: '',
  resume: '',
  projectsTitle: 'PROJECT’S',
  skillsTitle: 'SKILLS',
  softwareTitle: 'SOFTWARES KNOWN',
  contactTitle: 'CONTACTS',
  projects: [
    {
      id: 'pawfolio',
      name: 'PawFolio',
      image: '/pawfolio.png',
      description:
        'A pet portfolio and management platform, designed with a friendly interface for pet owners.',
      url: '',
      github: '',
    },
    {
      id: 'konekt',
      name: 'KONEKTbarangay',
      image: '/konek.png',
      description:
        'A community platform that connects residents with barangay services and information.',
      url: '',
      github: '',
    },
    {
      id: 'todos',
      name: 'Awesome Todos',
      image: '/aws.png',
      description: 'A simple task manager for keeping everyday work organized.',
      url: '',
      github: '',
    },
  ],
  skills: [
    { id: 'python', name: 'Python', subtitle: 'Programming', percent: 75 },
    { id: 'c', name: 'C', subtitle: 'Programming', percent: 70 },
    { id: 'java', name: 'Java', subtitle: 'Programming', percent: 40 },
  ],
  software: [
    {
      id: 'vscode',
      name: 'VS CODE',
      description:
        'I use VS Code for my programming purpose especially for HTML, CSS, JavaScript, C, Python. The UI and extensions in this make me code easier.',
      image: '',
      icon: '',
    },
    {
      id: 'figma',
      name: 'FIGMA',
      description:
        'Figma is a software for UI/UX designing, image editing, etc. I use this software to create a UI for my projects and web pages.',
      image: '',
      icon: '',
    },
  ],
  animations: { enabled: true, typingSpeed: 90, ringDuration: 1600 },
  copyright: 'All Rights Reserved.',
};
