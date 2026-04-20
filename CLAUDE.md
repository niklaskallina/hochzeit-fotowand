# CLAUDE.md — Hochzeit Fotowand

> Kontextdatei für Claude Code. Beschreibt Architektur, Konventionen, Dateien und bekannte Stolperfallen dieses Projekts.

## Was das Projekt ist

Live-Fotowand für eine Hochzeit. Gäste scannen einen QR-Code an ihrem Tisch, laden Fotos über eine mobile Web-Seite hoch, und die Bilder erscheinen direkt auf einer Slideshow, die auf einem Beamer oder TV läuft. Wenn niemand uploaded, läuft die Slideshow mit den vorhandenen Bildern weiter.

Vergleichbar mit dem kommerziellen Service **slidery.app**, aber kostenlos und mit Brautpaar-Branding (Bild + Willkommenstext).

## Stack

- **Hosting:** Vercel (Hobby-Plan, kostenlos)
- **Speicher & Bild-CDN:** Cloudinary (Free Plan, 25 GB)
- **Backend:** Vercel Serverless Functions (Node.js, in `/api/*.js`)
- **Frontend:** Reines HTML/CSS/JavaScript, keine Framework-Abhängigkeit, kein Build-Step
- **Domain:** `hochzeit-fotowand.vercel.app` (Beispiel)

Bewusste Designentscheidung: **Keine Datenbank.** Sowohl die Fotos als auch die Event-Settings (Brautpaar-Bild, Texte) liegen in Cloudinary.

## Routen

| URL | Datei | Zweck |
|---|---|---|
| `/` | `public/upload.html` | Upload-Seite für Gäste (per QR scanbar) |
| `/slideshow` | `public/slideshow.html` | Live-Slideshow für Beamer/TV |
| `/admin` | `public/admin.html` | Admin-Seite: Brautpaar-Bild & Texte einstellen |
| `/qr` | `public/qr-generator.html` | QR-Code-Karten zum Ausdrucken |
| `/api/sign-upload` | `api/sign-upload.js` | Liefert signierte Cloudinary-Upload-URLs |
| `/api/images` | `api/images.js` | Liste aller Gäste-Fotos für die Slideshow |
| `/api/settings` | `api/settings.js` | Event-Einstellungen lesen/schreiben |

Routing wird in `vercel.json` definiert (siehe unten — wichtig: Vercel verwendet **`public/` als Auto-Root**, deshalb müssen die `destination`-Pfade ohne `/public/` Prefix sein).

## Environment Variables (in Vercel zu setzen)

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
ADMIN_PASSWORD
```

Die ersten drei aus dem Cloudinary-Dashboard. `ADMIN_PASSWORD` selbst gewählt — schützt `/admin` und Brautpaar-Bild-Uploads.

## Cloudinary-Struktur

| Cloudinary-Pfad | Was liegt dort | Wer schreibt dorthin |
|---|---|---|
| `hochzeit/*` | Gäste-Fotos (Hochzeit) | Gäste (signed upload, ohne Passwort) |
| `hochzeit-meta/couple-photo` | Brautpaar-Bild | Admin (signed upload mit `x-admin-password`) |
| `hochzeit-meta/settings` (raw, JSON) | Event-Settings: `coupleNames`, `welcomeText`, `couplePhotoUrl` | Admin (via `/api/settings` POST) |

Foto-Metadaten (Uploader-Name, Grußnachricht): Werden als Cloudinary **Context** an jedem Bild gespeichert (`caption=...|alt=...`), nicht in einer separaten Tabelle.

## Dateien — Funktion und Rolle

### `package.json`
Minimal. Einzige Dependency: `cloudinary@^2.5.1`. Kein Build-Script.

### `vercel.json`
**Kritisch:** Vercel erkennt `public/` als statischen Asset-Ordner und exponiert dessen Inhalt direkt unter Root. Deshalb müssen die Rewrites ohne `/public/` Prefix arbeiten:

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/", "destination": "/upload.html" },
    { "source": "/slideshow", "destination": "/slideshow.html" },
    { "source": "/admin", "destination": "/admin.html" },
    { "source": "/qr", "destination": "/qr-generator.html" }
  ]
}
```

Wenn die Rewrites mit `/public/`-Pfaden gebaut werden, kommt 404. Das war ein häufiger Fehler beim initialen Setup.

### `api/sign-upload.js`
Generiert signierte Cloudinary-Upload-URLs. Zwei Modi via `mode`-Feld im Body:

- `"guest"` (Standard): Upload in Ordner `hochzeit`, Context mit `name` + `message`. Kein Auth.
- `"couple"`: Upload als `hochzeit-meta/couple-photo`, mit `overwrite: true` und `invalidate: true`. Auth via `x-admin-password` Header erforderlich.

Wichtig beim Signieren: Alle Parameter, die zur Cloudinary-API geschickt werden, müssen auch in der Signatur enthalten sein, sonst lehnt Cloudinary den Upload mit "Invalid Signature" ab.

### `api/images.js`
Liest alle Bilder aus Cloudinary-Ordner `hochzeit`, sortiert nach `created_at` desc, max. 200. Jedes Bild bekommt eine optimierte URL mit `width: 1920, height: 1920, crop: 'limit'` — wichtig: **beide Dimensionen** angeben, sonst werden Hochkant-Bilder zu hoch und in der Slideshow abgeschnitten.

Cache-Header: `no-store`, damit neue Uploads sofort sichtbar werden.

### `api/settings.js`
Liest und schreibt die Event-Settings als JSON-Datei (`hochzeit-meta/settings`) in Cloudinary.

**Drei Methoden:**
- `GET`: Settings öffentlich lesen (für Upload-Seite)
- `HEAD`: Reine Passwort-Prüfung ohne Datenänderung (für Admin-Login)
- `POST`: Settings schreiben (mit Auth)

**Achtung — Cloudinary-CDN-Cache-Falle:** Beim Lesen der raw-JSON-Datei muss die **versionierte URL** verwendet werden, sonst liefert das CDN eine alte Version. Konkret: erst per `cloudinary.api.resource()` die aktuelle Versionsnummer holen, dann mit `cloudinary.url(..., { version: ... })` die URL bauen. Beim Schreiben `invalidate: true` setzen.

Vorherige naive Implementierung (Upload + direkter Fetch der `secure_url`) führte dazu, dass GET nach POST immer noch alte/leere Daten zurückgab. Das hat Stunden Debugging gekostet.

### `public/upload.html`
Mobile Upload-Seite für Gäste. Lädt beim Öffnen die Settings (`/api/settings` GET) und zeigt Brautpaar-Bild + Begrüßungstext an. Felder: Name, Nachricht, Mehrfach-Datei-Upload mit Drag & Drop. Upload erfolgt **direkt vom Browser zu Cloudinary** mit der Signatur von `/api/sign-upload`. Vercel dient nur als Vermittler, bekommt die Bilddaten nie selbst zu Gesicht — das umgeht Vercel-Function-Größenlimits.

### `public/slideshow.html`
Vollbild-Slideshow für TV/Beamer.

**Wichtige Features:**
- Pollt `/api/images` alle 8 Sekunden
- Doppel-Slide-System (slide-a + slide-b) für sauberes Crossfade
- Layout: Flexbox mit `flex: 1 1 auto` für Bildbereich, `flex: 0 0 auto` für Caption — robuster als Grid für variable Bildhöhen
- Bilder mit `max-width: 100%`, `max-height: 100%`, `object-fit: contain` — komplette Anzeige unabhängig von Hoch-/Querformat
- **Kein** `transform: scale()` Zoom-Effekt — der hat früher Hochkant-Fotos abgeschnitten
- **Kein** `overflow: hidden` am Bild-Wrapper
- Caption (Name + Nachricht) sitzt **unter** dem Bild, nicht als Overlay
- Settings via Tastatur (Pfeil rechts/Leertaste = nächstes Bild, F = Vollbild) und über Einstellungs-Panel oben rechts
- Settings werden in `localStorage` gespeichert (Anzeigedauer, Random, Captions an/aus, neue Uploads bevorzugt)

### `public/admin.html`
Passwort-geschützte Admin-Seite.

**Login-Flow** (wichtig wegen Bug-History):
1. User tippt Passwort ein
2. HEAD-Request an `/api/settings` mit `x-admin-password` Header zur reinen Auth-Prüfung — schreibt nichts
3. Bei Erfolg: GET der aktuellen Settings, Felder befüllen
4. Passwort in `sessionStorage` für Auto-Login

**Wichtig:** Nicht versuchen, beim Login einen Dummy-POST zu machen (= war früher der Bug). Dummy-POSTs überschreiben echte Daten.

**Bild-Upload-Flow:**
1. Admin wählt Datei → Upload zu Cloudinary mit `mode: 'couple'`
2. Cloudinary überschreibt `hochzeit-meta/couple-photo`
3. URL wird mit Cache-Buster (`?v=${Date.now()}`) gespeichert
4. `saveSettings(true)` (silent) wird aufgerufen — **mit merge-Logik:** holt erst die aktuellen Settings und überschreibt nur das, was im Formular nicht leer ist. Sonst würde ein Bild-Upload, bevor Texte eingegeben wurden, leere Texte speichern.

**Save-Button**: nutzt `saveSettings(false)` — überschreibt explizit auch mit leeren Werten (User soll Texte löschen können).

### `public/qr-generator.html`
Standalone QR-Code-Generator für Druckkarten im A6-Format. **Wichtig: Komplett eigenständige QR-Erzeugung** — keine externe CDN-Bibliothek. Frühere Version lud `qrcode@1.5.3` von jsdelivr, was bei Browser-Sicherheitseinstellungen oder Adblockern blockiert wurde und die ganze Seite einfror (Eingabefelder reagierten nicht). Aktuelle Version enthält eine kompakte QR-Implementierung (basiert auf Project Nayuki Reference, MIT) inline und erzeugt SVG.

## Bekannte Stolperfallen

### 1. Vercel Auto-Detection
Vercel erkennt automatisch `public/` als statisches Verzeichnis und macht es zur Root. Daher in `vercel.json` **keine** `/public/`-Prefixe in `destination` verwenden. Symptom bei Falschsetzung: Alle Routen werfen 404, obwohl die Dateien deployed sind.

### 2. Cloudinary Raw-File CDN-Cache
Cloudinary-CDN cached raw-Files (wie unsere Settings-JSON) aggressiv. Beim Lesen IMMER die versionierte URL über `cloudinary.api.resource()` holen, niemals einen statischen Pfad oder die `secure_url` aus dem Upload-Result fest verdrahten.

### 3. Upload-Signaturen
Wenn Cloudinary "Invalid Signature" zurückgibt: alle Parameter, die im FormData mitgeschickt werden, müssen auch in der zu signierenden Parameter-Liste auftauchen (außer `file`, `api_key`, `signature`, `resource_type`).

### 4. Bild-Aspekt-Ratio in Slideshow
- `cloudinary.url()` braucht `width` UND `height` in `crop: 'limit'`-Mode, sonst wird nur eine Dimension begrenzt
- CSS auf `flex` mit `min-height: 0` am Bildcontainer, damit Bilder schrumpfen können
- Kein `transform: scale()` auf aktive Bilder
- Kein `overflow: hidden` am Bild-Wrapper

### 5. Browser-Konsole "Don't paste code"
Chrome blockiert seit Frühjahr 2024 das Einfügen von Code in die DevTools-Konsole als Anti-Phishing-Maßnahme. Lösung für Debug-Sessions: `allow pasting` tippen + Enter, dann ist Pasten freigegeben.

### 6. localStorage in Slideshow
Settings (Anzeigedauer etc.) werden im `localStorage` des Browsers gespeichert, der die Slideshow zeigt. Bei Browser-Wechsel oder Inkognito-Modus sind die Defaults aktiv.

## Setup für eine neue Hochzeit

1. Cloudinary-Account anlegen (cloud_name, api_key, api_secret notieren)
2. Repository forken/klonen, Code unverändert nutzen
3. Bei Vercel importieren, Env-Variablen setzen (siehe oben)
4. Nach Deployment: `/admin` öffnen, Brautpaar-Bild + Texte eintragen, speichern
5. `/qr` öffnen, eigene Domain eintragen, Karten ausdrucken
6. Am Hochzeitstag: `/slideshow` auf Laptop am Beamer öffnen, F drücken für Vollbild

## Lokales Entwickeln

```bash
npm install -g vercel
vercel dev
```

`vercel dev` simuliert das Vercel-Environment lokal mit den Functions. Env-Variablen müssen lokal in `.env.local` gesetzt sein.

## Was bewusst NICHT eingebaut ist

- **Keine Moderation:** Alle Uploads erscheinen sofort. Falls gewünscht, in Cloudinary unter Settings → Upload → Image Moderation aktivieren.
- **Keine OneDrive-Integration:** Wurde geprüft, aber Microsoft Graph erzwingt App Registration in Azure und OAuth-Token-Refresh, was für ein einmaliges Event Overkill ist. Nach der Hochzeit kann der gesamte Cloudinary-Ordner als ZIP heruntergeladen und ins OneDrive kopiert werden (Cloudinary Free hat kein Datei-Ablaufdatum).
- **Keine Echtzeit-Push (WebSockets):** Slideshow pollt alle 8 Sekunden. Für eine Hochzeit ausreichend, deutlich einfacher als WebSockets-Setup.
- **Kein Build-Step:** Bewusst Vanilla-JS, keine React/Vue/Build-Pipeline. Maximale Robustheit, jeder kann den Code lesen und ändern.
- **Keine Datenbank:** Cloudinary speichert sowohl Fotos als auch Settings.

## Wenn Claude Code an diesem Projekt weiterarbeitet

- Neue API-Endpunkte als `api/<name>.js` anlegen — Vercel erkennt sie automatisch
- Neue HTML-Seiten in `public/` ablegen + Eintrag in `vercel.json` für saubere URL
- Bei Cloudinary-Aufrufen immer Cache-Aspekte mitdenken (`invalidate: true`, versionierte URLs)
- Bei Änderungen an `api/sign-upload.js`: Sicherstellen, dass Signatur-Parameter und FormData-Parameter konsistent bleiben
- Mobile-First: Upload-Seite wird primär auf Smartphones genutzt
- Slideshow läuft potenziell stundenlang ohne Aufsicht — defensiv programmieren, nie crashen lassen, immer auf leere Listen prüfen

## Änderungen an Texten

Alle UI-Texte sind auf Deutsch (Hochzeitskontext, deutschsprachiges Publikum). Bei i18n-Wunsch wäre ein zusätzlicher `lang`-Parameter in den Settings sinnvoll und Übersetzungen direkt in die HTML-Dateien.
