# Changelog

## [1.4.0] - 26-06-2026

- Unterstützung für die vier neuen Sensoren der Integration v1.4.0
    - Leasing-Enddatum (als Datum formatiert)
    - Geschätzter Kilometerstand am Leasingende
    - Geschätzte Mehr-Strecke (rot, wenn über dem Limit)
    - Geschätzte Mehrkosten (mit Währungssymbol €, $, £, CHF)
- Neue Schalter im grafischen Editor für alle vier Sensoren
- Datums- und Währungsformat passen sich der Systemsprache an
- Mehrsprachige Labels (Deutsch / Englisch) für die neuen Sensoren

## [1.3.0] - 26-06-2026

- Mehrsprachigkeit / Multilingual
    - Alle Texte werden automatisch in der Systemsprache von Home Assistant angezeigt (Deutsch / Englisch)
    - Status, Metrik-Labels, Fortschritt und der grafische Editor sind übersetzt
    - Zahlenformat passt sich der Sprache an (1.861 vs. 1,861)
    - Fallback auf Englisch für nicht unterstützte Sprachen

## [1.2.0] - 15-06-2026

- Kompatibilität mit neuer Leasing Tracker Integration (v2+)
    - Sensoren werden jetzt über die Geräte-Registry erkannt (sprach- und umbenennungssicher)
    - Status-Werte (on_plan, over_plan, ...) werden korrekt übersetzt
    - Unterstützung für km und Meilen (dynamische Einheit)
- Grafischer Editor repariert und in die Karte integriert
    - Status-Sensor per Entity-Picker auswählbar
    - Alle Optionen per Schalter konfigurierbar
- Rückwärtskompatibilität zur alten Integration beibehalten

## [1.1.0] - 09-02-2026

- Mobile UI Fix

## [1.0.8] - 05-02-2026

- UI CSS Fix

## [1.0.7] - 05-02-2026

- UI Fix
    - Spalten Anzahl einstellbar

## [1.0.6] - 05-02-2026

- UI Fix
    - Anpassbarer Hintergrund

## [1.0.5] - 05-02-2026

- Performance Updates
    - Karte läd nicht mehr bei jeder HACS änderung nach

## [1.0.4] - 05-02-2026

- Titel kann jetzt ein-/ ausgeblendet werden
- Status kann jetzt auch ein-/ augeblendet werden

## [1.0.1] - 05-02-2026

- Initiales Release
- Grundlegendes Design festgelegt
