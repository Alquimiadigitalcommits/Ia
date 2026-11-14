// Lee los datos públicos de un link (caption, autor) con oEmbed. No necesita claves.
// Si falla, se sigue sin esos datos.

export interface Referencia {
  url: string;
  plataforma: "TikTok" | "YouTube" | "Instagram" | "Otro";
  titulo?: string;
  autor?: string;
  autorUrl?: string;
}

export const extraerLinks = (s: string) =>
  [...new Set(s.match(/https?:\/\/[^\s<>"]+/g) ?? [])].map((l) => l.replace(/[.,)]+$/, ""));

function plataformaDe(url: string): Referencia["plataforma"] {
  if (/tiktok\.com/i.test(url)) return "TikTok";
  if (/youtu\.?be/i.test(url)) return "YouTube";
  if (/instagram\.com/i.test(url)) return "Instagram";
  return "Otro";
}

async function oembed(endpoint: string, url: string) {
  const res = await fetch(`${endpoint}?format=json&url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  return (await res.json()) as { title?: string; author_name?: string; author_url?: string };
}

export async function leerReferencia(url: string): Promise<Referencia> {
  const plataforma = plataformaDe(url);
  const ref: Referencia = { url, plataforma };
  try {
    let datos = null;
    if (plataforma === "TikTok") {
      // Los links cortos (vm.tiktok.com / tiktok.com/t/) redirigen al video real.
      const real = /vm\.tiktok|tiktok\.com\/t\//i.test(url)
        ? (await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(6000) })).url
        : url;
      datos = await oembed("https://www.tiktok.com/oembed", real);
    } else if (plataforma === "YouTube") {
      datos = await oembed("https://www.youtube.com/oembed", url);
    }
    // Instagram exige token de Meta para oEmbed: queda solo el link.
    if (datos) {
      ref.titulo = datos.title?.slice(0, 500);
      ref.autor = datos.author_name;
      ref.autorUrl = datos.author_url;
    }
  } catch (e) {
    console.warn(`No se pudo leer ${url}:`, (e as Error).message);
  }
  return ref;
}

export const leerReferencias = (links: string[]) => Promise.all(links.slice(0, 5).map(leerReferencia));
