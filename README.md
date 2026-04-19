# Fotowand für die Hochzeit — Setup

Live-Fotowand, bei der Gäste per QR-Code Fotos hochladen und diese direkt auf einem Beamer oder TV erscheinen. Wenn niemand hochlädt, läuft die Slideshow mit allen vorhandenen Bildern weiter.

**Was du am Ende hast:**

1. **Upload-Seite** für Gäste (mobiloptimiert, mit Brautpaar-Bild und persönlichem Willkommenstext im Header)
2. **Live-Slideshow** für den Beamer/TV am Hochzeitstag
3. **Admin-Seite** zum Einstellen von Brautpaar-Bild und Begrüßungstext
4. **QR-Code-Generator** zum Ausdrucken der Tischkarten

Alles kostenlos. Einrichtungszeit: etwa 15 Minuten.

---

## Schritt 1 — Cloudinary-Account anlegen

Cloudinary speichert und liefert die Fotos aus. Der Free Plan reicht für eine Hochzeit locker aus (25 GB Speicher, 25 GB Traffic pro Monat).

1. Auf **cloudinary.com** registrieren (Free Plan wählen)
2. Im Dashboard oben stehen drei Werte, die du gleich brauchst:
   - `Cloud Name`
   - `API Key`
   - `API Secret`

Die Ordner werden automatisch beim ersten Upload angelegt — du musst in Cloudinary nichts manuell erstellen.

---

## Schritt 2 — Projekt auf GitHub hochladen

1. Lege einen GitHub-Account an, falls noch nicht vorhanden (**github.com**)
2. Erstelle ein neues privates Repository, z. B. `hochzeit-fotowand`
3. Lade alle Dateien aus diesem Projektordner hoch (einfachster Weg: Schaltfläche „Add file → Upload files" auf GitHub, dann die Ordner `api`, `public` und die Dateien `package.json`, `vercel.json` reinziehen)

---

## Schritt 3 — Deployment mit Vercel

Vercel hostet die Seite kostenlos. Hobby-Plan reicht völlig.

1. Auf **vercel.com** mit dem GitHub-Account anmelden
2. „Add New… → Project" klicken
3. Dein Repository `hochzeit-fotowand` auswählen → „Import"
4. Bei **Environment Variables** vier Einträge hinzufügen:
   - `CLOUDINARY_CLOUD_NAME` = dein Cloud Name
   - `CLOUDINARY_API_KEY` = dein API Key
   - `CLOUDINARY_API_SECRET` = dein API Secret
   - `ADMIN_PASSWORD` = ein Passwort deiner Wahl (z. B. `hochzeit2026`) — damit schützt du die Admin-Seite
5. „Deploy" klicken — nach etwa einer Minute ist die Seite live

Du bekommst eine URL, etwa `https://hochzeit-fotowand-abc123.vercel.app`.

**Optional — eigene Domain:** In den Vercel-Projekteinstellungen unter „Domains" kannst du eine kürzere URL verbinden, z. B. `fotos.anna-und-tom.de`.

---

## Schritt 4 — Brautpaar-Bild und Willkommenstext einstellen

1. Rufe `https://deine-url.vercel.app/admin` auf
2. Gib das Admin-Passwort ein (aus Schritt 3)
3. Brautpaar-Bild hochladen (quadratisches Bild ca. 500 × 500 px empfohlen — wird automatisch rund zugeschnitten)
4. Namen eintragen (z. B. „Anna & Tom")
5. Begrüßungstext schreiben, z. B.:
   > Herzlich willkommen an unserem großen Tag! Teilt eure schönsten Bilder — sie erscheinen live auf unserer Fotowand.
6. Speichern

Beide Felder sind optional — wenn du sie leer lässt, nutzt die Seite die Standardtexte.

---

## Schritt 5 — Testen

- **Upload-Seite:** `https://deine-url.vercel.app/` → Brautpaar-Bild und dein Text sollten oben erscheinen. Testfoto hochladen, sollte klappen
- **Slideshow:** `https://deine-url.vercel.app/slideshow` → das hochgeladene Foto sollte erscheinen

---

## Schritt 6 — QR-Codes drucken

1. Die Datei `qr-generator.html` lokal im Browser öffnen (Doppelklick reicht)
2. URL deiner Upload-Seite eintragen (NICHT `/admin` oder `/slideshow`, sondern die Hauptseite)
3. Anzahl der Karten festlegen (eine pro Tisch, ggf. eine pro Platz)
4. „Karten erzeugen" → „Drucken"

Die Karten sind im A6-Format. Für mehrere Karten pro A4-Seite: PDF drucken und in Word oder Preview zusammenstellen, oder direkt auf Kartonpapier drucken lassen (z. B. bei dm-Fotoservice oder flyeralarm).

---

## Am Hochzeitstag

**Für den Beamer/TV:**

1. Laptop an den Beamer anschließen
2. Browser öffnen (Chrome oder Firefox), `https://deine-url.vercel.app/slideshow` aufrufen
3. Mit `F` auf der Tastatur in den Vollbildmodus wechseln
4. Fertig — die Slideshow läuft von selbst und zeigt neue Uploads automatisch an

**Einstellungen während der Feier:** Mauszeiger bewegen, dann oben rechts auf „Einstellungen" klicken. Einstellbar:

- **Anzeigedauer pro Bild:** 2 bis 60 Sekunden (empfohlen: 6–10 Sekunden)
- **Zufällig mischen:** Bilder in zufälliger Reihenfolge, sonst chronologisch
- **Neue Uploads bevorzugt:** Neu hochgeladene Fotos werden als nächstes gezeigt (empfohlen: an)
- **Namen & Nachrichten:** Blendet Uploader-Namen und Grußtexte ein

**Tastatur-Shortcuts:**

- `Leertaste` oder `→`: Nächstes Bild sofort
- `F`: Vollbild ein/aus

---

## Hinweise

**Stromsparmodus am Laptop deaktivieren**, damit der Bildschirm während der Feier nicht dunkel wird. Bei Windows unter „Energieoptionen", bei macOS unter „Systemeinstellungen → Batterie → Netzteil".

**Internetverbindung:** Die Location sollte stabiles WLAN oder guten Mobilfunk haben. Für den Laptop mit der Slideshow: wenn möglich per Kabel ans Internet.

**Moderation:** Diese Version zeigt alle Uploads sofort an. Falls du das nicht willst, kannst du in Cloudinary unter „Settings → Upload" „Image moderation" aktivieren — dann musst du jedes Bild manuell freigeben.

**Fotos nach der Hochzeit herunterladen:** Im Cloudinary-Dashboard unter „Media Library → Ordner hochzeit" kannst du alle Bilder als ZIP exportieren.

**Admin-Seite absichern:** Die URL `/admin` ist per Passwort geschützt (`ADMIN_PASSWORD`). Gib die URL und das Passwort nicht öffentlich weiter — sonst könnten Gäste das Brautpaar-Bild oder den Willkommenstext ändern.

---

## Dateistruktur

```
hochzeit/
├── api/
│   ├── sign-upload.js      ← signierte Upload-URLs (Gäste + Admin)
│   ├── images.js           ← liefert Bilderliste für die Slideshow
│   └── settings.js         ← Event-Einstellungen lesen/schreiben
├── public/
│   ├── upload.html         ← Upload-Seite (Gäste, per QR)
│   ├── slideshow.html      ← Slideshow (Beamer/TV)
│   ├── admin.html          ← Admin-Seite (Bild + Text einstellen)
│   └── qr-generator.html   ← QR-Karten-Druckvorlage (lokal öffnen)
├── package.json
└── vercel.json
```

---

## Vergleich mit slidery.app

Funktional identisch zu Slidery (QR-Upload, Live-Slideshow, neue Uploads priorisiert, Download nach dem Event aus Cloudinary), aber:

- **Kostenlos** statt 24,90 € einmalig
- **Brautpaar-Bild + persönlicher Willkommenstext** auf der Upload-Seite
- **Keine Upload-Limits**, keine Speichergrenzen außer denen von Cloudinary (25 GB im Free Plan — reicht für tausende Fotos)
- **Volle Kontrolle** über Design und Daten

Trade-off: Slidery ist ein fertiger Service ohne Setup. Unser Ansatz braucht einmalig die 15-Minuten-Einrichtung auf Cloudinary und Vercel.
