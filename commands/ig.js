import fs from "fs";
import path from "path";
import os from "os";
import fetch from "node-fetch";

const homeDir = os.homedir();

const isTermux =
  process.platform === "android" ||
  homeDir.includes("/data/data/com.termux/files/home");

const DOWNLOAD_DIR = isTermux
  ? path.join(homeDir, "storage", "shared", "Perez_Bot")
  : path.join(homeDir, "Perez_Bot");

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

function guessExtFromContentType(ct) {
  if (!ct) return "bin";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("mp4")) return "mp4";
  if (ct.includes("mpeg")) return "mp4";
  if (ct.includes("ogg")) return "ogg";
  return "bin";
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      // use a mobile user-agent and referer to increase chance of public page HTML
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Mobile Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.instagram.com/",
    },
    redirect: "follow",
  });
  return await res.text();
}

function extractOgMedia(html) {
  // 1) meta og:video, og:video:secure_url, og:video:url
  const metaVideo = html.match(/<meta[^>]+property=["']?(?:og:video|og:video:secure_url|og:video:url)["']?[^>]+content=["']([^"']+)["']/i);
  if (metaVideo) return { url: metaVideo[1], type: "video" };

  // 2) meta og:image or og:image:secure_url
  const metaImage = html.match(/<meta[^>]+property=["']?(?:og:image|og:image:secure_url)["']?[^>]+content=["']([^"']+)["']/i);
  if (metaImage) return { url: metaImage[1], type: "image" };

  // 3) application/ld+json with contentUrl or image
  const ldMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ldMatch) {
    try {
      const data = JSON.parse(ldMatch[1]);
      if (data && data.contentUrl) return { url: data.contentUrl, type: "video" };
      if (data && data.image) return { url: Array.isArray(data.image) ? data.image[0] : data.image, type: "image" };
    } catch (e) { }
  }

  // 4) Buscar JSON incrustado con keys "video_url" o "display_url" (Instagram page scripts)
  const videoJson = html.match(/"video_url"\s*:\s*"([^"]+)"/i);
  if (videoJson) {
    try { return { url: JSON.parse('"' + videoJson[1] + '"'), type: "video" }; } catch { return { url: videoJson[1], type: "video" }; }
  }

  const displayJson = html.match(/"display_url"\s*:\s*"([^"]+)"/i);
  if (displayJson) {
    try { return { url: JSON.parse('"' + displayJson[1] + '"'), type: "image" }; } catch { return { url: displayJson[1], type: "image" }; }
  }

  // 5) twitter card fallback
  const twitterPlayer = html.match(/<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/i);
  if (twitterPlayer) return { url: twitterPlayer[1], type: "video" };

  return null;
}

export default {
  name: "ig",
  aliases: ["instagram"],
  async run(sock, msg, args, chatId) {
    try {
      const url = (args && args[0]) ? String(args[0]).trim() : null;
      if (!url) return;

      let link = url;
      if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
      if (!/instagram\.com/i.test(link)) {
        // if user pasted a short link without domain, ignore
        return;
      }

      console.log(`🔎 Intentando obtener metadata pública de: ${link}`);

      // 1) Intentar endpoint JSON público (más fiable cuando funciona)
      let media = null;
      try {
        const jsonUrl = link + (link.includes("?") ? "&" : "?") + "__a=1&__d=dis";
        const jres = await fetch(jsonUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Mobile Safari/537.36",
            Referer: "https://www.instagram.com/",
            Accept: "application/json",
          },
          redirect: "follow",
        });

        if (jres.ok) {
          const j = await jres.json().catch(() => null);
          const data = j?.graphql?.shortcode_media || j?.items?.[0] || null;
          if (data) {
            if (data.video_url || data.is_video && data.video_url) {
              media = { url: data.video_url || data.video_url, type: "video" };
            } else if (data.display_url) {
              media = { url: data.display_url, type: "image" };
            } else if (data.edge_sidecar_to_children && data.edge_sidecar_to_children.edges) {
              // take first
              const first = data.edge_sidecar_to_children.edges[0]?.node;
              if (first) {
                if (first.is_video) media = { url: first.video_url, type: "video" };
                else media = { url: first.display_url, type: "image" };
              }
            }
          }
        }
      } catch (e) { /* ignore JSON endpoint errors and fallback to HTML */ }

      // 2) fallback a HTML si no se obtuvo media
      if (!media) {
        console.log(`🔎 Descargando página HTML: ${link}`);
        const html = await fetchHtml(link);
        media = extractOgMedia(html);
      }

      if (!media || !media.url) {
        console.log("❌ No se encontró media en la página.");
        return;
      }

      // algunos enlaces vienen con parámetros o son relativos; asegurarse de URL completa
      let mediaUrl = media.url;
      if (mediaUrl.startsWith("//")) mediaUrl = "https:" + mediaUrl;
      if (!/^https?:\/\//i.test(mediaUrl)) mediaUrl = new URL(mediaUrl, link).toString();

      console.log(`⬇️ Descargando media: ${mediaUrl}`);
      const res = await fetch(mediaUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) {
        console.log("❌ Error descargando el media: ", res.status, res.statusText);
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      const ext = guessExtFromContentType(contentType);
      const fileName = `ig_${Date.now()}.${ext}`;
      const filePath = path.join(DOWNLOAD_DIR, fileName);

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // enviar directamente al chat (no guardar en disco)
      try {
        if (media.type === "image") {
          await sock.sendMessage(chatId, { image: buffer, fileName }, { quoted: msg });
          console.log(`✅ Enviado imagen al chat ${chatId}`);
          return;
        }

        if (media.type === "video") {
          await sock.sendMessage(chatId, { video: buffer, mimetype: contentType, fileName }, { quoted: msg });
          console.log(`✅ Enviado video al chat ${chatId}`);
          return;
        }

        // fallback: enviar como documento
        await sock.sendMessage(chatId, { document: buffer, mimetype: contentType, fileName }, { quoted: msg });
        console.log(`✅ Enviado archivo al chat ${chatId}`);
      } catch (e) {
        console.log("❌ Error enviando media al chat:", e?.message || e);
      }
    } catch (e) {
      console.log("❌ Error en comando .ig:", e?.message || e);
    }
  },
};
