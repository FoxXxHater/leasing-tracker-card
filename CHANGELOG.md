# Changelog

## [1.4.0] - 26-06-2026

- Support for the four new sensors of integration v1.4.0
    - Lease end date (formatted as a date)
    - Estimated odometer at lease end
    - Estimated excess distance (red when over the limit)
    - Estimated excess cost (with currency symbol €, $, £, CHF)
- New toggles in the graphical editor for all four sensors
- Date and currency format adapt to the system language
- Multilingual labels (German / English) for the new sensors

## [1.3.0] - 26-06-2026

- Multilingual support
    - All texts are automatically shown in the Home Assistant system language (German / English)
    - Status, metric labels, progress and the graphical editor are translated
    - Number format adapts to the language (1.861 vs. 1,861)
    - Fallback to English for unsupported languages

## [1.2.0] - 15-06-2026

- Compatibility with the new Leasing Tracker integration (v2+)
    - Sensors are now detected via the device registry (language- and rename-proof)
    - Status values (on_plan, over_plan, ...) are translated correctly
    - Support for km and miles (dynamic unit)
- Graphical editor fixed and integrated into the card
    - Status sensor selectable via entity picker
    - All options configurable via toggles
- Backward compatibility with the old integration retained

## [1.1.0] - 09-02-2026

- Mobile UI fix

## [1.0.8] - 05-02-2026

- UI CSS fix

## [1.0.7] - 05-02-2026

- UI fix
    - Number of columns adjustable

## [1.0.6] - 05-02-2026

- UI fix
    - Customizable background

## [1.0.5] - 05-02-2026

- Performance updates
    - Card no longer reloads on every HACS change

## [1.0.4] - 05-02-2026

- Title can now be shown/hidden
- Status can now also be shown/hidden

## [1.0.1] - 05-02-2026

- Initial release
- Basic design established
