export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options.headers },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error('The server returned an invalid response. Please try again.');
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(
      typeof data?.error === 'string' && data.error
        ? data.error
        : 'Request failed. Please try again.',
    );
    error.status = response.status;
    error.details = data?.details;
    throw error;
  }
  if (path === '/content') {
    const { contentSchema } = await import('../shared/content.js');
    const parsed = contentSchema.safeParse(data?.content);
    if (!parsed.success || !Number.isSafeInteger(data?.revision) || data.revision < 1) {
      const error = new Error('The server returned an invalid response. Please try again.');
      error.status = response.status;
      throw error;
    }
    return { ...data, content: parsed.data };
  }
  return data;
}
