export async function setupApiStatus(element: HTMLElement) {
  element.textContent = "API: connecting...";
  try {
    const response = await fetch("/api/hello");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    element.textContent = `API: ${await response.text()}`;
  } catch (error) {
    element.textContent = `API: failed (${String(error)})`;
  }
}
