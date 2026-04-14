export default {
    name: "menu",
    aliases: ["help", "comandos", "cmd"],
    async run(sock, msg) {
        const texto = `
╭─〔 *PEREZ_BOT* 〕─╮
│
│ 📂 *Comando principal:*
│ .v
│
│ 🔁 *Alias de v:*
│ .ver
│ ..
│ .,
│ .ufff
│ .esta
│ .jajajaja
│
│ 📌 *Uso:*
│ Responde a un view once con
│ cualquiera de esos comandos
│ 📌 *Aviso:*
│ Puedes cambiar los alias, pero
│ no se actualizará este menú.
│ De igual manera, el bot seguirá
│ respondiendo a los alias nuevos
│
╰────────────────╯
`.trim();

        await sock.sendMessage(msg.key.remoteJid, { text: texto }, { quoted: msg });
    },
};