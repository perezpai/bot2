# Perez_Bot

> Bot de WhatsApp basado en **Baileys** para recuperar archivos de “ver una sola vez” (foto, video y audio) y guardarlos en el almacenamiento del dispositivo.  
> Basado en la librería [Baileys](https://github.com/whiskeysockets/Baileys).

---

## 🚀 Características

Perez_Bot te permite recuperar cualquier contenido de “ver una sola vez” y guardarlo localmente sin dejar rastro en el chat.

- Recupera:
  - Imágenes de ver una vez
  - Videos de ver una vez
  - Audios de ver una vez
- Guarda automáticamente en:

  ```text
  storage/shared/PerezBot/

## 🚀 Características

- Recupera:
  - Imágenes de ver una vez
  - Videos de ver una vez
  - Audios de ver una vez
- Guarda automáticamente en:
```
storage/shared/PerezBot/
```
- Funcionamiento silencioso (no envía nada al chat)
- Sistema modular (index.js + commands/)
- Acceso restringido al owner

---


## 📥 Instalación

### 📱 Android (Termux)

```
git clone https://github.com/perezpai/bot2.git 
cd bot2
npm install
node index.js
```

Escanea el QR:

WhatsApp > Menú ⋮ > Dispositivos vinculados > Vincular dispositivo

--- 

### 💻 PC (Windows / Linux)

```
git clone https://github.com/perezpai/bot2.git 
cd bot2
npm install
node index.js
```

### 📱 Android (Termux)

```
pkg update && pkg upgrade
pkg install git nodejs -y
termux-setup-storage
cd ~
git clone https://github.com/perezpai/bot2.git
cd bot2
npm install
node index.js
```

Escanea el QR:

WhatsApp > Menú ⋮ > Dispositivos vinculados > Vincular dispositivo

---

### 💻 PC (Windows / Linux)

```
git clone https://github.com/perezpai/bot2.git
cd Perez_Bot
npm install
node index.js
```

---

## 🧠 Uso

### Comando principal

```
.v
```

### Alias

```
..
.,
.ver
.ufff
.esta
.jajajaja
```

### Flujo de uso

1. Recibe un archivo de “ver una vez”
2. Responde a ese mensaje con:

```
.v
```

3. El archivo se guardará en:

```
storage/shared/PerezBot/
```

Ejemplo:

```
imagen_perezbot_1712400000000.jpg
video_perezbot_1712400000000.mp4
audio_perezbot_1712400000000.ogg
```

Nota: El bot no envía el archivo al chat.

---

## ⚙️ Configuración

Edita tu número en index.js:

```
const OWNER_NUMBER = "573001234567";
```

Ejemplo:

```
const OWNER_NUMBER = "573001234567";
```

Formato:
- Sin +
- Con código de país
- Sin espacios ni guiones

---

### 📤 Sincronización a Google Drive (opcional)

El bot puede subir automáticamente los archivos guardados a Google Drive.

Pasos rápidos:

1. Crear credenciales OAuth2 en Google Cloud Console:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Tipo: "Desktop app" (o "Other")
   - Descargar el JSON y guardarlo en la raíz del proyecto como `drive_credentials.json`.
2. (Opcional) Crear una carpeta en tu Google Drive y obtener su `folderId`.
   - Exportar la variable de entorno `DRIVE_FOLDER_ID` antes de ejecutar el bot si quieres subir a esa carpeta:
     - PowerShell: `$env:DRIVE_FOLDER_ID = 'TU_FOLDER_ID'`
     - Linux/Termux: `export DRIVE_FOLDER_ID=TU_FOLDER_ID`
3. Instalar dependencias y ejecutar:
   - `npm install`
   - `node index.js`
4. Al primer intento de subida el módulo mostrará una URL de autorización en la consola.
   - Abre la URL, autoriza la app y pega el código que te devuelva Google en la consola.
   - El token se guardará en `drive_token.json`.

Archivos creados por la integración:
- `drive_credentials.json` (credenciales OAuth2 que debes obtener desde Google Cloud)
- `drive_token.json` (token generado tras autorizar la app)

No subas esos archivos al repositorio. Añade `drive_credentials.json` y `drive_token.json` a `.gitignore`.

## 📂 Estructura

```
bot2/
├── commands/
│   └── v.js
├── index.js
├── package.json
├── README.md
└── .gitignore
```

---

## 🔐 Seguridad

> auth_info/ → NO subir
> node_modules/ → ignorado

> ⚠️ Nunca subas tu carpeta `auth_info/` (sesión de WhatsApp) a GitHub.
> El bot no responde en el chat, solo guarda los archivos.

---

## 🛠️ Problemas comunes

### No guarda archivos

```
termux-setup-storage
```

Verifica:

```
ls ~/storage/shared/PerezBot
```

---

### No responde

- Usa .v
- Debe ser el número owner
- Revisa la consola

---

## 🧾 Licencia

MIT License

---

## 👨‍💻 Autor 

BrayanRK  
https://github.com/BrayanRK/Draven_Hack
Yo (PerezPai) me he basado en su código para crear esta versión.

⚠️ **Advertencia de Uso**

Este bot ha sido desarrollado únicamente con fines educativos y de automatización personal. Al utilizarlo, aceptas que lo haces bajo tu propia responsabilidad.

El creador no se hace responsable por el uso indebido, ilegal o inapropiado de esta herramienta, incluyendo —pero no limitado a— la descarga, distribución o almacenamiento de contenido sin autorización de sus respectivos propietarios.

Es responsabilidad del usuario cumplir con las leyes locales, así como con los términos y condiciones de uso de plataformas como WhatsApp.

El uso de este bot implica la aceptación total de estos términos.
