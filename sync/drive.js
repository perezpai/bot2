import fs from "fs";
import path from "path";
import readline from "readline";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const TOKEN_PATH = path.join(process.cwd(), "drive_token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "drive_credentials.json");

function askQuestion(text) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(text, (ans) => { rl.close(); resolve(ans); }));
}

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`No se encontró ${CREDENTIALS_PATH}. Cree credenciales OAuth2 en Google Cloud Console y guárdelas en ese archivo.`);
  }

  const content = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const creds = content.installed || content.web;
  if (!creds) throw new Error("Formato inválido en drive_credentials.json");

  const { client_secret, client_id, redirect_uris } = creds;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  const authUrl = oAuth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES });
  console.log("🔗 Abra esta URL en su navegador y autorice la aplicación:\n", authUrl);
  const code = await askQuestion("Código de autorización: ");
  const { tokens } = await oAuth2Client.getToken(code.trim());
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log("✅ Token guardado en:", TOKEN_PATH);
  return oAuth2Client;
}

async function uploadFile(filePath, mimeType, nameOverride) {
  try {
    if (!fs.existsSync(filePath)) throw new Error("Archivo no encontrado: " + filePath);
    const auth = await authorize();
    const drive = google.drive({ version: "v3", auth });

    const fileName = nameOverride || path.basename(filePath);
    const fileMetadata = { name: fileName };
    const folderId = process.env.DRIVE_FOLDER_ID;
    if (folderId) fileMetadata.parents = [folderId];

    const media = { mimeType: mimeType || "application/octet-stream", body: fs.createReadStream(filePath) };

    const res = await drive.files.create({ resource: fileMetadata, media, fields: "id,webViewLink,webContentLink" });
    console.log("Drive response:", res.data);
    return res.data;
  } catch (e) {
    console.log("❌ Error subiendo a Drive:", e?.message || e);
    return null;
  }
}

export default { uploadFile };