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
const OWNER_NUMBER = "573223090406"; // Tu número sin +

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

function normalizeJidToNumber(jid = "") {
    return String(jid).split("@")[0].replace(/\D/g, "");
}

function getSenderCandidates(msg) {
    return [
        msg?.key?.participantPn,
        msg?.key?.participantAlt,
        msg?.key?.participant,
        msg?.key?.remoteJidAlt,
        msg?.key?.remoteJid,
        msg?.participant,
        msg?.sender,
    ].filter(Boolean);
}

// 🔥 FUNCIÓN CORREGIDA (OWNER DETECTION PERFECTA)
function isOwnerMessage(msg) {
    if (msg?.key?.fromMe) return true;

    const candidates = [
        ...getSenderCandidates(msg),
        msg?.message?.extendedTextMessage?.contextInfo?.participant,
        msg?.message?.extendedTextMessage?.contextInfo?.remoteJid
    ].filter(Boolean);

    console.log("📩 Candidates:", candidates);

    for (const c of candidates) {
        const num = normalizeJidToNumber(c);
        console.log("🔍 Checking:", num);

        if (num === OWNER_NUMBER) {
            console.log("✅ OWNER DETECTADO");
            return true;
        }
    }

    console.log("❌ NO ES OWNER");
    return false;
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

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        console.log("🔄 Estado conexión:", connection);

        if (qr && !sock.authState?.creds?.registered) {
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
            console.log("🔁 Reconectar:", shouldReconnect);

            if (shouldReconnect) {
                setTimeout(() => startBot(), 3000);
            } else {
                console.log("⚠️ Borra auth_info para reiniciar sesión.");
            }
        }
    });

    if (!state.creds.registered) {
        const choice = await askWithTimeout(
            "🔐 ¿Cómo conectar? (1=QR, 2=Código): ",
            60000,
            "1"
        );

        if (choice === "2") {
            const phone = await question("📱 Tu número: ");
            const code = await sock.requestPairingCode(phone.trim());
            console.log("🔑 Código:", code);
        } else {
            console.log("📲 Esperando QR...");
        }
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message) return;

        const body = getTextMessage(msg).trim();

        console.log("📩 BODY:", body);
        console.log("🧾 MSG.KEY:", msg.key);

        if (!body.startsWith(".")) return;

        if (!isOwnerMessage(msg)) {
            console.log("🚫 Comando ignorado: no es del owner");
            return;
        }

        let commandName;
        let args = [];

        if (body.trim() === ".") {
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
