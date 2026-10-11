export const onVercel = process.env.VERCEL === '1';
export const uploadStorage = process.env.UPLOAD_STORAGE || (onVercel ? 'mongodb' : 'disk');
export const maxUploadBytes = (onVercel ? 4 : 8) * 1024 * 1024;
export const sessionDuration = 8 * 60 * 60 * 1000;
