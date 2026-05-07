/**
 * Generic fetcher function for SWR.
 * Performs a GET request and parses the response as JSON.
 *
 * @param url - The URL to fetch
 * @returns Promise resolving to the parsed JSON response
 * @throws When the response is not ok (non-2xx status)
 */
export const fetcher = <T = unknown>(url: string): Promise<T> =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    return r.json() as Promise<T>;
  });