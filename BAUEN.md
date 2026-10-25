# prodday bauen

Kurzanleitung für Linux (Nobara/Fedora). Befehle **einzeln** einfügen.

## Neuen Stand bauen und aufs Handy bringen

```bash
cd ~/Projekte/dayglance
git checkout main
git pull origin main
npm ci
npm run build:android
cd dayglance-android
rm -rf app/build/intermediates/compressed_assets
./gradlew :app:assembleGithubDebug
adb install -r app/build/outputs/apk/github/debug/app-github-debug.apk
cd ..
```

- `npm ci` ist nur nötig, wenn sich Pakete geändert haben (`package-lock.json`). Im Zweifel einfach ausführen.
- Das `rm -rf …compressed_assets` verhindert den Fehler „already contains entry“ durch alte Web-Dateien.
- `adb install -r` aktualisiert die App, die Daten bleiben erhalten.
- Ohne USB: die APK aus `dayglance-android/app/build/outputs/apk/github/debug/` aufs Handy kopieren (z. B. über Nextcloud) und dort antippen.

## Schnell im Browser testen (ohne Gradle)

```bash
cd ~/Projekte/dayglance
npm run dev
```

Dann http://localhost:5173 öffnen, beenden mit Strg+C. Die Browser-Version hat eigene Daten; denselben Nextcloud-Ordner verbinden, um die Einträge vom Handy zu sehen.

## Einen bestimmten Zweig testen (vor dem Mergen)

```bash
git fetch origin
git checkout ZWEIGNAME
git pull origin ZWEIGNAME
```

Danach wie oben ab `npm ci` bauen. Zurück zum Hauptstand mit `git checkout main`.

## Wenn etwas hakt

| Meldung | Abhilfe |
|---|---|
| `adb devices` zeigt `unauthorized` | Am Handy „USB-Debugging zulassen“ bestätigen |
| `SDK location not found` | `echo "sdk.dir=$HOME/Android/Sdk" > dayglance-android/local.properties` |
| Java-Fehler (z. B. „Unsupported class file“) | `java -version` muss 21 zeigen, sonst `JAVA_HOME` in `~/.bashrc` prüfen |
| `node: Befehl nicht gefunden` | Neues Terminal öffnen (nvm lädt Node 22) |
| `npm run build:android` meldet Paket-Abweichungen | `npm ci` ausführen |
| App zeigt nur eine weiße Seite | `npm run build:android` vor Gradle vergessen |
| Gradle bricht mit „already contains entry“ ab | `rm -rf dayglance-android/app/build/intermediates/compressed_assets` |
| Komplett neu bauen | `cd dayglance-android && ./gradlew clean && cd ..`, danach normal bauen |

## Einmalige Einrichtung (zur Erinnerung)

- **Java 21** (Temurin) in `~/.jdks`, `JAVA_HOME` in `~/.bashrc`
- **Node 22** über nvm
- **Android SDK** in `~/Android/Sdk` (`platform-tools`, `platforms;android-36`), `ANDROID_HOME` in `~/.bashrc`
- `dayglance-android/local.properties` mit `sdk.dir=…` (wird nicht eingecheckt)
- Am Handy: Entwickleroptionen und USB-Debugging an
