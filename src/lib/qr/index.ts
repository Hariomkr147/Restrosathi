import QRCode from "qrcode";

export function tableUrl(code: string): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/t/${encodeURIComponent(code)}`;
}
export async function qrSvg(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 4 });
  return svg.replace(/fill="[^"]*"/g, 'fill="var(--color-surface-raised)"')
    .replace(/stroke="[^"]*"/g, 'stroke="var(--color-text)"');
}
