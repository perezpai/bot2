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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  return await res.text();
}

function extractOgMedia(html) {
  // buscar og:video primero
  const videoMatch = html.match(/<meta\s+property=(?:"|')og:video(?:"|')\s+content=(?:"|')([^"']+)(?:"|')/i);
  if (videoMatch) return { url: videoMatch[1], type: "video" };

  // buscar og:image (puede ser imagen o poster)
  const imgMatch = html.match(/<meta\s+property=(?:"|')og:image(?:"|')\s+content=(?:"|')([^"']+)(?:"|')/i);
  if (imgMatch) return { url: imgMatch[1], type: "image" };

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

      console.log(`🔎 Descargando página: ${link}`);
      const html = await fetchHtml(link);
      const media = extractOgMedia(html);
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
