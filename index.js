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
const OWNER_FILE = path.join(SESSION_DIR, "owner.txt");

// El OWNER será la cuenta autenticada (la sesión del bot). Se asigna a BOT_OWNER
// cuando se cargan las credenciales.
let BOT_OWNER = null;

// Función para guardar el OWNER persistentemente
function saveOwner(ownerNumber) {
    try {
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }
        fs.writeFileSync(OWNER_FILE, ownerNumber, "utf8");
    } catch (e) {
        console.error("❌ Error guardando OWNER:", e.message);
    }
}

// Función para cargar el OWNER guardado
function loadOwner() {
    try {
        if (fs.existsSync(OWNER_FILE)) {
            const stored = fs.readFileSync(OWNER_FILE, "utf8").trim();
            if (stored) return stored;
        }
    } catch (e) {
        console.error("❌ Error cargando OWNER:", e.message);
    }
    return null;
}

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

function normalizeNumber(jid = "") {
    // Extraer SOLO los dígitos del inicio (antes de cualquier símbolo)
    const match = String(jid).match(/^(\d+)/);
    return match ? match[1] : "";
}

// 🔥 OWNER FLEXIBLE
function isOwnerMessage(msg, sock) {
    // Permitir ejecuciones desde la propia sesión del bot
    if (msg?.key?.fromMe) {
        console.log("✅ Mensaje del bot (fromMe=true)");
        return true;
    }

    // Si es un grupo, permitir comandos (sin restricción de owner)
    const isGroup = msg?.key?.remoteJid?.endsWith("@g.us");
    if (isGroup) {
        console.log("✅ Comando en GRUPO - permitido");
        return true;
    }

    // En DM, verificar que sea el propietario
    if (!BOT_OWNER) {
        console.log("⚠️ OWNER no determinado. Comando denegado.");
        return false;
    }

    const sender = msg?.key?.remoteJid || "";
    const num = normalizeNumber(sender);

    console.log(`📊 Debug: sender="${sender}", normalized="${num}", BOT_OWNER="${BOT_OWNER}"`);

    const isOwner = num === BOT_OWNER || num.slice(-10) === BOT_OWNER.slice(-10);
    console.log(`${isOwner ? "✅" : "❌"} Verificación OWNER en DM: ${isOwner}`);

    return isOwner;
}

async function startBot() {
    const commands = await loadCommands();

    console.log(
        "✅ Comandos cargados:",
        [...new Set([...commands.values()].map((c) => c.name))].join(", ")
    );

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    // Intentar cargar el OWNER guardado (persistente)
    let savedOwner = loadOwner();

    // Determinar el OWNER de forma segura
    if (savedOwner) {
        BOT_OWNER = savedOwner;
        console.log("✅ Owner cargado desde archivo persistente:", BOT_OWNER);
    } else if (state?.creds?.me?.id) {
        BOT_OWNER = normalizeNumber(state.creds.me.id);
        saveOwner(BOT_OWNER);
        console.log("✅ Owner asignado desde credenciales:", BOT_OWNER);
    } else if (process.env.BOT_OWNER) {
        BOT_OWNER = normalizeNumber(process.env.BOT_OWNER);
        saveOwner(BOT_OWNER);
        console.log("✅ Owner asignado desde env BOT_OWNER:", BOT_OWNER);
    } else {
        BOT_OWNER = null;
        console.log(
            "⚠️ Owner no disponible. Se asignará cuando la sesión se abra."
        );
    }

    console.log("✅ Usando versión WA:", version);

    const sock = makeWASocket({
        version,
        browser: Browsers.ubuntu("Chrome"),
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔥 OPCIÓN DE VINCULACIÓN (NO INTERFIERE CON QR)
    setTimeout(async () => {
        const useCode = await askWithTimeout(
            "🔐 ¿Usar código de vinculación? (1=No, 2=Sí): ",
            15000,
            "1"
        );

        if (useCode === "2") {
            const phone = await question("📱 Número (sin +): ");
            try {
                const code = await sock.requestPairingCode(phone.trim());
                console.clear();
                console.log("🔑 Código de vinculación:", code);
                console.log("📱 WhatsApp > Dispositivos vinculados > Vincular con número");
            } catch (e) {
                console.log("❌ Error generando código:", e);
            }
        } else {
            console.log("📲 Esperando QR...");
        }
    }, 1500);

    sock.ev.on("connection.update", (update) => {
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
            console.log("✅ BOT CONECTADO 🚀");
            console.log(`👤 OWNER: ${BOT_OWNER}`);
            // Si el OWNER aún no está asignado, intentar determinarlo
            if (!BOT_OWNER) {
                try {
                    const sessionId = sock?.user?.id || state?.creds?.me?.id;
                    if (sessionId) {
                        BOT_OWNER = normalizeNumber(sessionId);
                        saveOwner(BOT_OWNER);
                        console.log("✅ Owner determinado en apertura:", BOT_OWNER);
                    }
                } catch (e) {
                    console.log("⚠️ No se pudo determinar OWNER en apertura:", e);
                }
            }
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

        if (!body) return;
        if (!body.startsWith(".")) return;

        console.log("📩 BODY:", body);
        console.log(`📍 BOT_OWNER ACTUAL: ${BOT_OWNER}`);
        console.log(`📍 msg.key.fromMe: ${msg?.key?.fromMe}`);
        console.log(`🔍 DEBUG ESTRUCTURA:`);
        console.log(`   - msg.key.participant: ${msg?.key?.participant}`);
        console.log(`   - msg.key.remoteJid: ${msg?.key?.remoteJid}`);
        console.log(`   - msg.participant: ${msg?.participant}`);
        console.log(`   - msg.pushName: ${msg?.pushName}`);

        if (!isOwnerMessage(msg, sock)) {
            console.log("🚫 No autorizado");
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