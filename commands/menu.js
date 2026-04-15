export default {
    name: "menu",
    aliases: ["help", "comandos", "cmd"],
    async run(sock, msg) {
        const texto = `
--─〔 *PEREZ_BOT* 〕─--

 📂 *Comandos principales:*
 .v         → Guarda localmente (respondiendo a un view-once)
 .ig <url>  → Descarga media público de Instagram y lo envía al chat
 .descargar → Guarda un estado (respondiendo al mensaje del estado reenviado)

 🔁 *Alias de .v:*
 .ver  ..  .,  .ufff  .esta  .jajajaja

 📌 *Uso rápido:*
 - Para recuperar un "ver una sola vez": responde ese mensaje con `.v`.
 - Para descargar un post de Instagram público: escribe `.ig <url>`.
 - Para guardar un estado: reenvía/compare el estado al chat y responde con `.descargar`.

 ⚠️ El bot solo ejecuta comandos del owner.

`.trim();

        await sock.sendMessage(msg.key.remoteJid, { text: texto }, { quoted: msg });
    },
};