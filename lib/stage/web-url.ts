// A Stage "web" piece frames a page inside the grid. Only public https pages qualify: no
// credentials, no loopback or private-network hosts, so a generated piece can't aim the
// user's browser at their own network.
const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|.*\.localhost|\[.*\]|(\d{1,3}\.){3}\d{1,3})$/i;

export function isEmbeddableStageUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.hostname.includes(".") &&
      !PRIVATE_HOST.test(url.hostname)
    );
  } catch {
    return false;
  }
}
