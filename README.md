# prodday

Ein persönlicher Tagesplaner für Android: Aufgaben, Zeitplan und Notizen in einer App.

prodday ist ein privates Hobbyprojekt und ein Fork von **[dayGLANCE](https://github.com/krelltunez/dayGLANCE)** von krelltunez. Der allergrößte Teil des Codes stammt aus dem Original. prodday ergänzt ihn um eigene Funktionen und passt ihn an den persönlichen Bedarf an.

> prodday ist **kein** offizielles dayGLANCE-Produkt und steht in keiner Verbindung zu dessen Autor. Fehler in prodday bitte nicht beim Original melden.

## Änderungen gegenüber dayGLANCE

- Eigener Name, eigene App-Kennung (`io.github.klukenapoletana.prodday`) und eigenes Symbol
- Pastellfarben und ein Farbrad mit neun speicherbaren eigenen Farben, die mit synchronisiert werden
- OLED-Design mit echtem Schwarz
- Freie Dauer im 5-Minuten-Raster, eingestellt per Scrollrad (Stunden und Minuten)
- Datum, Uhrzeit und „Ganztägig“ in einer Zeile
- Durchstreichen und Einrückung in Notizen
- Wiederholungen alle N Tage, Wochen, Monate oder Jahre, wahlweise „ab Erledigung“
- Übersichtlichere Wiederholungsauswahl (Nie, Täglich, Wöchentlich, Monatlich, Jährlich, Benutzerdefiniert)
- Erinnerungen pro Eintrag: vor Beginn, am Tag oder zu einem festen Zeitpunkt, auch für Einträge im Posteingang
- Kleinere Anpassungen, z. B. die Einfügelinie beim Verschieben

## Bauen

Voraussetzungen: Node.js 22, JDK 21 und das Android SDK.

```bash
npm ci
npm run build:android
cd dayglance-android
./gradlew :app:assembleGithubDebug
```

Die APK liegt danach unter `dayglance-android/app/build/outputs/apk/github/debug/`.

Zum Ausprobieren im Browser: `npm run dev`.

Die Ordner und internen Namen (`dayglance-android`, Paketnamen im Code usw.) stammen aus dem Original und sind bewusst unverändert, damit sich Änderungen von dort leichter übernehmen lassen.

## Lizenz und Marken

Der Code steht wie das Original unter der [MIT-Lizenz](LICENSE). Der Copyright-Hinweis des Originals bleibt unverändert erhalten.

Name, Logo und App-Symbol von **dayGLANCE** sind Marken ihres Inhabers und **nicht** von der MIT-Lizenz abgedeckt. prodday verwendet sie nicht als eigene Marke. Wo „dayGLANCE“ hier genannt wird, bezeichnet es nur die Herkunft des Codes. Im App-Code selbst können noch Texte mit dem Originalnamen stecken. prodday wird nicht als fertige App verbreitet.

Mitgelieferte Schrift: [Lora](https://github.com/cyrealtype/Lora-Cyrillic) (© The Lora Project Authors) unter der [SIL Open Font License 1.1](https://scripts.sil.org/OFL).

Das Original unterstützen: [dayGLANCE auf GitHub](https://github.com/krelltunez/dayGLANCE).
