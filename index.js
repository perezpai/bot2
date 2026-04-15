js
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

const question = (text) =>
    new Promise((resolve) => rl.question(text, resolve));

function askWithTimeout(text, timeoutMs = 60000, defaultVal = "1") {
    return new Promise((resolve) => {
        process.stdout.write(text);

        let resolved = false;

        const onLine = (input) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            rl.removeListener("line", onLine);
            resolve(String(input || "").trim());
        };

        rl.on("line", onLine);

        const timer = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            rl.removeListener("line", onLine);
            resolve(defaultVal);
        }, timeoutMs);
    });
}

async function loadCommands() {
    const commands = new Map();

    if (!fs.existsSync(COMMANDS_DIR)) {
        fs.mkdirSync(COMMANDS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(COMMANDS_DIR).filter((file) =>
        file.endsWith(".js")
    );

    for (const file of files) {
        const fullPath = path.join(COMMANDS_DIR, file);
        const module = await import(`file://${fullPath}`);
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

// 🔥 OWNER SIMPLE Y 100% FUNCIONAL
function isOwnerMessage(msg) {
    return msg?.key?.fromMe === true;
}

async function startBot() {
    const commands = await loadCommands();
    console.log(
        "✅ Comandos cargados:",
        [...new Set([...commands.values()].map((c) => c.name))].join(", ")
    );

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    console.log("✅ Usando versión WA:", version);

    const logger = pino({ level: "silent" });
    logger.child = () => logger;

    const sock = makeWASocket({
        version,
        browser: Browsers.ubuntu("Chrome"),
        logger,
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔥 MENSAJE INICIAL (SOLO UNA VEZ)
    console.log("🔐 Iniciando conexión...");
    const choice = await askWithTimeout(
        "🔐 ¿Cómo conectar? (1=QR, 2=Código): ",
        60000,
        "1"
    );

    if (choice === "2") {
        const phone = await question("📱 Tu número: ");
        try {
            const code = await sock.requestPairingCode(phone.trim());
            console.clear();
            console.log("🔑 Código de vinculación:", code);
        } catch (e) {
            console.log("❌ Error generando código:", e);
        }
    } else {
        console.log("📲 Escanea el QR cuando aparezca...");
    }

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.clear();
            console.log("📲 Escanea este QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "connecting") {
            console.log("⏳ Conectando...");
        }

        if (connection === "open") {
            console.clear();
            console.log("✅ BOT CONECTADO Y LISTO 🚀");
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log("❌ Conexión cerrada:", statusCode);

            if (shouldReconnect) {
                console.log("🔁 Reconectando...");
                setTimeout(() => startBot(), 3000);
            } else {
                console.log("⚠️ Borra auth_info para reiniciar sesión.");
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message) return;

        const body = getTextMessage(msg).trim();

        // ❌ Ignorar basura
        if (!body) return;
        if (!body.startsWith(".")) return;

        console.log("📩 BODY:", body);

        // 🔒 SOLO OWNER (tú)
        if (!isOwnerMessage(msg)) {
            console.log("🚫 No es owner");
            return;
        }

        let commandName;
        let args = [];

        if (body === ".") {
            commandName = ".";
        } else {
            const parts = body.slice(1).trim().split(/\s+/);
            commandName = parts[0]?.toLowerCase();
            args = parts.slice(1);
        }

        const command = commands.get(commandName);
        if (!command) return;

        try {
            console.log(`🟡 Ejecutando: ${commandName}`);
            await command.run(sock, msg, args, msg.key.remoteJid);
        } catch (e) {
            console.log(`❌ Error en ${commandName}:`, e);
        }
    });
}

startBot();