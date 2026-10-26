# Releases von prodday

Ein Release ist eine signierte Android-APK, die GitHub Actions baut und als
**Entwurf** an einen GitHub-Release hängt
(`.github/workflows/release-android.yml`). Einen Entwurf sehen nur der
Repo-Inhaber und Mitwirkende; prodday wird nicht öffentlich verbreitet
(README). Veröffentlichen ist ein bewusster eigener Schritt auf GitHub.

Die Runbooks des Originals für Desktop, iOS und Play Store gelten hier nicht;
deren Workflows laufen nur noch von Hand.

## Einmalig: Signier-Schlüssel

Jedes Update muss mit **demselben Schlüssel** signiert sein wie die
installierte Version, sonst lehnt Android es ab. Geht der Schlüssel verloren,
lässt sich prodday nur noch durch Deinstallieren und Neuinstallieren
aktualisieren (die Daten kommen dann wieder über den Sync).

1. Schlüssel erzeugen (das JDK bringt `keytool` mit). Es fragt nach einem
   Passwort und ein paar Angaben zur Person; die Angaben dürfen leer bleiben.

   ```bash
   keytool -genkeypair -v -keystore prodday-release.keystore \
     -alias prodday -keyalg RSA -keysize 4096 -validity 10000
   ```

2. **Sichern:** `prodday-release.keystore` und das Passwort an zwei sicheren
   Orten aufbewahren (z. B. Passwort-Manager und verschlüsselte Sicherung).
   Nie ins Repo legen.

3. Für GitHub in Text umwandeln:

   ```bash
   base64 -w0 prodday-release.keystore > keystore.b64
   ```

4. Auf GitHub unter **Settings → Secrets and variables → Actions → New
   repository secret** vier Secrets anlegen:

   | Name | Inhalt |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | der Inhalt von `keystore.b64` |
   | `ANDROID_KEYSTORE_PASSWORD` | das Passwort aus Schritt 1 |
   | `ANDROID_KEY_ALIAS` | `prodday` |
   | `ANDROID_KEY_PASSWORD` | dasselbe Passwort (keytool nutzt eines für beides) |

   Danach `keystore.b64` löschen.

## Jeder Release

1. Auf einem neuen Zweig die Version setzen, als PR mergen:

   ```bash
   npm run bump 1.1.0
   ```

   Das schreibt `package.json`, `package-lock.json` und `versionName` in
   `dayglance-android/app/build.gradle.kts`. Dazu die Release-Notizen
   `docs/releases/v1.1.0.md` anlegen.

2. Nach dem Merge auf GitHub unter **Actions → Release Android → Run
   workflow** (Zweig `main`) starten. Der Workflow liest die Version aus
   `package.json`, legt den Tag (`v1.1.0`) selbst an und baut ihn. Läuft er
   für einen Tag, zu dem es schon einen Release gibt, baut er diesen noch
   einmal. Ein Tag ohne Release (ein fehlgeschlagener Lauf) wird auf den
   aktuellen Stand von `main` verschoben.

   Wer lieber lokal arbeitet, kann den Tag auch selbst hochladen
   (`git tag v1.1.0 && git push origin v1.1.0`); das startet den Workflow
   ebenso.

3. Der Workflow prüft, dass Tag, `package.json` und `versionName`
   übereinstimmen, baut die APK und legt den Entwurf mit
   `prodday-1.1.0.apk` und Prüfsumme an. Den `versionCode` errechnet er aus
   dem Tag (1.1.0 → 10100), so installiert sich jede Version über die
   vorige.

4. Unter **Releases** den Entwurf öffnen und die APK aufs Handy laden.
