# Perez_Bot

> Bot de WhatsApp basado en **Baileys** para recuperar archivos de “ver una sola vez” (foto, video y audio) y guardarlos en el almacenamiento del dispositivo.  
> Basado en la librería [Baileys](https://github.com/whiskeysockets/Baileys).

---

## 🚀 Características
Perez_Bot recupera archivos de "ver una sola vez" y permite guardarlos o reenviarlos según el comando.

- Recupera:
  - Imágenes de ver una vez
  - Videos de ver una vez
  - Audios de ver una vez
- Guarda localmente (comando `.v`):

  ```text
  # Termux
  /storage/shared/Perez_Bot/

  # PC / Linux / macOS
  ~/Perez_Bot/
  ```

- Comportamiento de comandos:
  - `.v` (respondiendo a un mensaje): guarda el archivo localmente en la carpeta anterior.
  - `.ig <url>`: descarga media público de Instagram y lo envía directamente al chat (no guarda localmente por defecto).
  - `.descargar` (respondiendo a un mensaje reenviado de un estado): guarda el media del estado en la carpeta local.
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

3. El archivo se guardará en (según plataforma):

```
# Termux
/storage/shared/Perez_Bot/

# PC / Linux / macOS
~/Perez_Bot/
```

Ejemplo:

```
imagen_perezbot_1712400000000.jpg
video_perezbot_1712400000000.mp4
audio_perezbot_1712400000000.ogg
```

Nota: El comando `.v` guarda localmente y no envía nada al chat. El comando `.ig` descarga media de Instagram y lo envía directamente al chat.
Nota: El comando `.descargar` guarda estados localmente (respondiendo al mensaje reenviado del estado).

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
