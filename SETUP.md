# Setup — SaaS-Betrieb

Diese Doku beschreibt, wie du die Plattform von einem Einzelprojekt in einen Multi-Mandanten-SaaS überführst und betreibst.

## 1. Externe Services einrichten

### 1.1 Supabase (DB + Auth)
1. Projekt auf https://supabase.com anlegen (Free-Tier reicht zum Start)
2. Aus dem Dashboard folgende Werte notieren:
   - **Project URL** (`SUPABASE_URL`)
   - **anon public key** (`SUPABASE_ANON_KEY`) — für Browser-Clients
   - **service_role key** (`SUPABASE_SERVICE_ROLE_KEY`) — **geheim**, nur für Server
3. SQL-Editor öffnen und `supabase/schema.sql` aus diesem Repo ausführen
4. **Authentication → Providers → Email**: „Confirm email" auf „Off" stellen für Magic-Link-only (oder lassen, dann bestätigt der Nutzer zuerst per Mail)
5. **Authentication → URL Configuration**: deine Vercel-Domain als „Site URL" eintragen, und `https://<domain>/auth/callback` als Redirect URL

### 1.2 Cloudinary (bestehend)
Nichts ändert sich am Account. Neue Struktur:
```
events/<eventId>/photos/*     → Gäste-Uploads pro Event
events/<eventId>/meta/couple  → Brautpaar-Bild pro Event
events/<eventId>/meta/settings → JSON-Settings pro Event
```
Der alte `hochzeit/`-Ordner bleibt bestehen (wird zu Legacy), neue Events nutzen die obige Struktur.

### 1.3 Resend (Transaktions-Mails)
1. Account auf https://resend.com
2. API-Key erzeugen (`RESEND_API_KEY`)
3. **Domain verifizieren** (wichtig!) — sonst landen Mails im Spam
4. Absender-Adresse z.B. `hallo@deinedomain.de`

### 1.4 Vercel Pro
Hobby-Plan erlaubt **keine kommerzielle Nutzung** (Vercel AGB). Upgrade → Pro (20 $/Monat).

### 1.5 PayPal (später, Etappe 3)
- PayPal Business-Konto erstellen
- Für den Einstieg reicht ein **PayPal.me-Link** (`paypal.me/deinName`) — der Kunde überweist, du aktivierst das Event manuell (siehe Admin-Panel)
- Automatisierung via PayPal REST API / Webhooks kommt in Etappe 3

### 1.6 Domain
Empfehlungen: Porkbun, Namecheap, INWX. Nach dem Kauf in Vercel → Settings → Domains hinzufügen; DNS-Einträge laut Vercel-Anleitung beim Registrar setzen.

## 2. Environment-Variablen (in Vercel setzen)

```
# Cloudinary (bestehend)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend
RESEND_API_KEY=
MAIL_FROM="Fotowand <hallo@deinedomain.de>"

# Super-Admin (du selbst)
SUPER_ADMIN_EMAILS=deine@mail.de,zweite@mail.de

# App-URL (für Magic-Links)
APP_URL=https://deinedomain.de

# Legacy Admin (für bestehende /admin-Seite, bis Migration abgeschlossen)
ADMIN_PASSWORD=
```

## 3. Schema migrieren

```sql
-- In Supabase SQL Editor ausführen:
-- Inhalt von supabase/schema.sql
```

Das Schema ist idempotent (nutzt `IF NOT EXISTS`) — kannst du bedenkenlos wiederholen.

## 4. Rollen & Zugriff

### Endkunde (Brautpaar)
- Kauft ein Event (später per PayPal, vorerst manuell von dir freigeschaltet)
- Loggt sich per Magic-Link ein (`/login`)
- Verwaltet im Dashboard: QR, Texte, Brautpaar-Bild, Fotos, Download
- Sieht nur **eigene** Events (durchgesetzt über Supabase Row Level Security)

### Super-Admin (du)
- E-Mail muss in `SUPER_ADMIN_EMAILS` stehen
- Kann alle Events sehen, manuell aktivieren, Plan ändern, löschen
- Zugang: `/admin-panel` (nicht die alte `/admin`-Seite)

### Gast (Hochzeitsbesucher)
- Scannt QR, landet auf `/e/<slug>` (öffentlich, kein Login)
- Lädt Fotos hoch, Cloudinary-Upload wird **strikt auf den Event-Ordner gescopt**

## 5. Rechtliches (DE, kommerziell)

Ich habe **Platzhalter-Seiten** erstellt:
- `/impressum` → `public/legal/impressum.html`
- `/datenschutz` → `public/legal/datenschutz.html`
- `/agb` → `public/legal/agb.html`
- `/widerruf` → `public/legal/widerruf.html`

**Die musst du mit echten Texten befüllen**, bevor du live gehst. Vorlagen: eRecht24, Trusted Shops, IT-Recht-Kanzlei, oder Anwalt. Haftungsausschluss hier — keine der Seiten ist von mir rechtsgeprüft.

AV-Verträge abschließen mit: Supabase, Cloudinary, Vercel, Resend, PayPal. Alle bieten Standard-AV-Verträge auf ihrer Website an (meist unter „Legal" / „DPA").

## 6. Betrieb

### Foto-Lifecycle
- Standard-Plan: 3 Monate Speicher, dann automatisches Löschen
- Premium: 12 Monate
- Umsetzung via Supabase-Cron-Job (wöchentlich, prüft `expires_at`, löscht Cloudinary-Ressourcen)

### Backups
- DB: Supabase macht Daily Backups (Free-Tier: 7 Tage, Pro: 30 Tage)
- Fotos: liegen in Cloudinary, kein extra Backup nötig (aber ZIP-Download-Funktion fürs Brautpaar zum Event-Ende)

### Monitoring
- Vercel zeigt Function-Errors im Dashboard
- Supabase zeigt DB-Metriken
- Für Uptime-Checks z.B. Better Stack / UptimeRobot Free-Tier

## 7. Migrationspfad vom Altbestand

Der bestehende `hochzeit/`-Cloudinary-Ordner ist weiter erreichbar über die alten Routen (`/`, `/slideshow`, `/admin`, `/stats`, `/qr`) — für deine bereits verplante Hochzeit keine Änderung nötig. Neue Events laufen über `/e/<slug>` mit eigenem Ordner.

Alte Routen kannst du deaktivieren, sobald das letzte Legacy-Event vorbei ist.

## 8. Deployment-Checkliste (vor Go-Live)

- [ ] Supabase-Projekt mit Schema
- [ ] Alle Env-Vars in Vercel gesetzt (Production UND Preview)
- [ ] Resend-Domain verifiziert, Test-Mail versendet
- [ ] Vercel Pro gebucht
- [ ] Domain auf Vercel gezeigt
- [ ] Rechtstexte mit echten Inhalten gefüllt
- [ ] AV-Verträge unterschrieben/archiviert
- [ ] Super-Admin-Account getestet (Manual-Activation funktioniert)
- [ ] Test-Durchlauf: Event anlegen → Magic-Link → Dashboard → QR → Upload als Gast → Slideshow zeigt Foto → Download ZIP
