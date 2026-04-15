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
let qrShown = false;
// drive sync removed

const SESSION_DIR = "./auth_info";
const COMMANDS_DIR = path.join(process.cwd(), "commands");
const OWNER_NUMBER = "573223090406"; // Tu número sin + y sin espacios

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const question = (text) =>
    new Promise((resolve) => rl.question(text, resolve));

// Pregunta con timeout usando el evento 'line' para poder cancelar correctamente
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

function isOwnerMessage(msg) {
    const senderCandidates = getSenderCandidates(msg);

    console.log("📩 Sender detectado:", senderCandidates);
    console.log("📱 Normalizado:", senderCandidates.map(normalizeJidToNumber));

    for (const candidate of senderCandidates) {
        const number = normalizeJidToNumber(candidate);
        if (number === OWNER_NUMBER) {
            return true;
        }
    }

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
        printQRInTerminal: false, // Necesario para código
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === "connecting") {
            console.log("⏳ Conectando...");
            return;
        }

        if (qr && !qrShown) {
            qrShown = true;
            console.clear();
            console.log("📲 Escanea este QR una sola vez:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            qrShown = false;
            console.log("✅ Bot conectado correctamente!");
            return;
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log("❌ Pai, conexión cerrada. Reconectar:", shouldReconnect);
            if (shouldReconnect) {
                setTimeout(() => startBot(), 3000);
            } else {
                console.log("⚠️ Sesión cerrada mi perro. Tenes que borrar auth_info si queres reconectar.");
            }
            return;
        }
    });

    // Permitir elegir entre QR o código de vinculación.
    // Si el usuario no responde en 15s, por defecto se usa QR.
    if (!state.creds.registered) {
        try {
            const choice = await askWithTimeout(
                "🔐 ¿Cómo quiere conectar? (1=QR, 2=Código) [por defecto 1 en 60s]: ",
                60000,
                "1"
            );

            if (String(choice).trim() === "2") {
                const phone = await question(
                    "📱 Tu número (solo dígitos y sin espacios, ej: 573012429540): "
                );
                try {
                    const code = await sock.requestPairingCode(phone.trim());
                    console.clear();
                    console.log(`\n🔑 CÓDIGO DE VINCULACIÓN: ${code}\n`);
                    console.log(
                        "📱 En WhatsApp > Dispositivos vinculados > Vincular con número de teléfono"
                    );
                    console.log("⏳ Esperando confirmación...");
                } catch (e) {
                    console.log("❌ Error generando código:", e?.message || e);
                    // no salir del proceso; simplemente continuar y esperar QR si llega
                }
            } else {
                console.log("📲 Esperando QR para vincular (escanea el código que aparecerá en la consola)...");
            }
        } catch (e) {
            console.log("❌ Error leyendo la opción de vinculación:", e?.message || e);
            console.log("📲 Procediendo a esperar QR...");
        }
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message) return;

        const body = getTextMessage(msg).trim();
        if (!body.startsWith(".")) return;

        // ✅ VERIFICACIÓN ESTRICTA: SOLO TUS MENSAJES
        if (!isOwnerMessage(msg)) {
            console.log("🚫 Comando ignorado: no es del owner");
            return;
        }

        let commandName;
        let args = [];

        // Special-case: single dot '.' invokes the command named '.'
        if (body.trim() === ".") {
            commandName = ".";
        } else {
            const parts = body.slice(1).trim().split(/\s+/);
            const rawCmd = parts[0];
            args = parts.slice(1);
            commandName = rawCmd?.toLowerCase();
        }

        if (!commandName) return;

        const command = commands.get(commandName);
        if (!command) return;

        try {
            console.log(`🟡 Ejecutando: ${commandName} por owner`);
            await command.run(sock, msg, args, msg.key.remoteJid);
        } catch (e) {
            console.log(`❌ Error en ${commandName}:`, e?.message || e);
        }
    });
}

startBot();