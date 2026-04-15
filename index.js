import fs from "fs";
import path from "path";
import readline from "readline";
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

const SESSION_DIR = "./auth_info";
const COMMANDS_DIR = path.join(process.cwd(), "commands");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function loadCommands() {
    const commands = new Map();

    if (!fs.existsSync(COMMANDS_DIR)) {
        fs.mkdirSync(COMMANDS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith(".js"));

    for (const file of files) {
        const module = await import(`file://${path.join(COMMANDS_DIR, file)}`);
const cmd = module.default;

if (!cmd?.name || typeof cmd.run !== "function") continue;

commands.set(cmd.name, cmd);

if (Array.isArray(cmd.aliases)) {
    for (const alias of cmd.aliases) {
        commands.set(alias, cmd);
    }
}
    }

return commands;
}

function getTextMessage(msg) {
    return (
        msg?.message?.conversation ||
        msg?.message?.extendedTextMessage?.text ||
        msg?.message?.imageMessage?.caption ||
        msg?.message?.videoMessage?.caption ||
        ""
    );
}

// 🔥 OWNER SIMPLE
function isOwnerMessage(msg) {
    return msg?.key?.fromMe === true;
}

async function startBot() {
    const commands = await loadCommands();

    console.log("✅ Comandos cargados:",
        [...new Set([...commands.values()].map(c => c.name))].join(", ")
    );

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        browser: Browsers.ubuntu("Chrome"),
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            console.clear();
            console.log("📲 Escanea este QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.clear();
            console.log("✅ BOT CONECTADO 🚀");
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log("❌ Conexión cerrada");

            if (shouldReconnect) {
                console.log("🔁 Reconectando...");
                startBot();
            } else {
                console.log("⚠️ Borra auth_info para reiniciar sesión");
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message) return;

        const body = getTextMessage(msg).trim();

        if (!body || !body.startsWith(".")) return;

        console.log("📩", body);

        if (!isOwnerMessage(msg)) {
            console.log("🚫 No es owner");
            return;
        }

        let commandName;
        let args = [];

        if (body === ".") {
            commandName = ".";
        } else {
            const parts = body.slice(1).split(/\s+/);
            commandName = parts[0].toLowerCase();
            args = parts.slice(1);
        }

        const command = commands.get(commandName);
        if (!command) return;

        try {
            console.log("🟡 Ejecutando:", commandName);
            await command.run(sock, msg, args, msg.key.remoteJid);
        } catch (e) {
            console.log("❌ Error:", e);
        }
    });
}

startBot();