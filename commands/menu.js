export default {
  name: "menu",
  aliases: ["help", "comandos", "cmd"],
  async run(sock, msg) {
    const texto = [
      '╭─〔 *PEREZ_BOT* 〕─╮',
      '│',
      '│ 📂 Comandos principales',
      '│  .v    → Guarda localmente',
      '│ (respondiendo a un view-once)',
      '│  .,	 → Guarda un estado (respondiendo', 
      '│ al mensaje reenviado) ejecutar como (punto+coma)',
      '│',
      '│ 🔁 Alias de .v: .ver  ..  .ufff  .esta  .jajajaja',
      '│ 🔁 Alias de .,: .estado, .story, .descargar',
      '',
      '│ 📌 Uso rápido:',
      '│  - Recuperar un "ver una sola vez":',
      '│ responde ese mensaje con .v',
      '│  - Guardar un estado: reenvía el estado al',
      "│ chat y responde con '(punto+coma)´",
      '│',
      '│ ⚠️ El bot solo ejecuta comandos del owner.',
      '╰────────-─-────╯',
    ].join('\n');

    await sock.sendMessage(msg.key.remoteJid, { text: texto }, { quoted: msg });
  },
};
