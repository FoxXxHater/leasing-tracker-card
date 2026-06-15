class LeasingTrackerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Bitte definiere eine Entity (Status-Sensor)');
    }
    this._config = config;
    this._initialized = false;
    this._sensorCache = null;
    if (this._hass) {
      this.render();
    }
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    
    // Nur rendern wenn nötig
    if (!this._config) return;
    
    // Erstes Render oder relevante Entity hat sich geändert
    if (!this._initialized || this._hasRelevantChange(oldHass, hass)) {
      this.render();
    }
  }

  _hasRelevantChange(oldHass, newHass) {
    if (!oldHass) return true;
    
    // Beim ersten Mal sind die Sensoren evtl. noch nicht gecached
    const sensors = this._sensorCache || this.findSensors();
    const entityIds = Object.values(sensors)
      .filter(Boolean)
      .map((e) => e.entity_id);
    
    if (entityIds.length === 0) return true;
    
    for (const entityId of entityIds) {
      const oldState = oldHass.states[entityId];
      const newState = newHass.states[entityId];
      if (!oldState || !newState || oldState.state !== newState.state) {
        return true;
      }
    }
    return false;
  }

  render() {
    if (!this._hass || !this._config) return;

    // Finde alle Sensoren (über Geräte-Registry)
    const sensors = this.findSensors();
    this._sensorCache = sensors;
    
    // Debug: Nur einmal loggen
    if (!this._initialized) {
      console.log('Leasing Tracker Card - Gefundene Sensoren:', sensors);
    }

    // Custom Styles aus Config
    const metricBg = this._config.metric_background || '';
    const metricBgHover = this._config.metric_background_hover || '';
    const columns = this._config.columns || 2;
    const columnsMobile = this._config.columns_mobile || 1;
    const customStyles = `
      <style>
        :host {
          --leasing-columns: ${columns};
          --leasing-columns-mobile: ${columnsMobile};
          ${metricBg ? `--leasing-metric-bg: ${metricBg};` : ''}
          ${metricBgHover ? `--leasing-metric-bg-hover: ${metricBgHover};` : ''}
        }
      </style>
    `;

    this.shadowRoot.innerHTML = `
      ${this.getStyles()}
      ${customStyles}
      <ha-card>
        ${this.renderHeader(sensors)}
        ${this.renderContent(sensors)}
      </ha-card>
    `;

    // Event Listener für Klicks
    this.shadowRoot.querySelectorAll('.metric').forEach(el => {
      el.addEventListener('click', (e) => {
        const entity = e.currentTarget.dataset.entity;
        if (entity) {
          this.fire('hass-more-info', { entityId: entity });
        }
      });
    });
    
    this._initialized = true;
  }

  findSensors() {
    const hass = this._hass;
    const statusEntityId = this._config.entity;
    const found = {};

    // Mapping: unique_id Suffix (sensor_type aus der Integration) -> interner Key
    const TYPE_MAP = {
      status: 'status',
      remaining_km_total: 'remaining_total',
      remaining_km_year: 'remaining_year',
      remaining_km_month: 'remaining_month',
      remaining_km_year_actual: 'remaining_year_actual',
      remaining_km_month_actual: 'remaining_month_actual',
      estimated_km_year_end: 'estimated_year_end',
      estimated_km_month_end: 'estimated_month_end',
      remaining_days: 'days',
      remaining_months: 'months',
      total_km_driven: 'driven',
      km_driven_this_month: 'driven_month',
      km_driven_this_year: 'driven_year',
      km_per_day_average: 'avg_day',
      km_per_month_average: 'avg_month',
      allowed_km_total: 'allowed_total',
      allowed_km_per_month: 'allowed_month',
      allowed_km_this_year: 'allowed_year_actual',
      allowed_km_this_month: 'allowed_month_actual',
      days_total: 'days_total',
      progress_percentage: 'progress',
      km_difference: 'difference',
    };

    // 1) Versuche, die Sensoren über die Geräte-Registry zu finden.
    //    Das ist sprach- und umbenennungssicher.
    const entityReg = hass.entities;
    const statusReg = entityReg ? entityReg[statusEntityId] : null;
    const deviceId = statusReg ? statusReg.device_id : null;

    if (deviceId && entityReg) {
      Object.keys(entityReg).forEach((entityId) => {
        const reg = entityReg[entityId];
        if (!reg || reg.device_id !== deviceId) return;
        if (!entityId.startsWith('sensor.')) return;

        // unique_id sieht aus wie "<entry_id>_<sensor_type>"
        const uid = reg.unique_id || '';
        let matchedKey = null;

        // Längste Übereinstimmung am Ende der unique_id zuerst prüfen
        const sortedTypes = Object.keys(TYPE_MAP).sort(
          (a, b) => b.length - a.length
        );
        for (const type of sortedTypes) {
          if (uid.endsWith('_' + type) || uid === type) {
            matchedKey = TYPE_MAP[type];
            break;
          }
        }

        // Fallback: über translation_key (falls vorhanden)
        if (!matchedKey && reg.translation_key && TYPE_MAP[reg.translation_key]) {
          matchedKey = TYPE_MAP[reg.translation_key];
        }

        if (matchedKey && hass.states[entityId]) {
          found[matchedKey] = hass.states[entityId];
        }
      });
    }

    // 2) Fallback: Falls die Registry nichts geliefert hat (z. B. sehr alte
    //    HA-Version), versuche es über die Entity-IDs anhand des Präfixes.
    if (Object.keys(found).length === 0) {
      const baseName = statusEntityId
        .replace('sensor.', '')
        .replace(/_status$/, '');

      // Suchbegriffe für beide Sprachen (DE/EN) und alte/neue Namen
      const PATTERNS = [
        { key: 'status', terms: ['status'] },
        { key: 'remaining_month', terms: ['remaining_distance_this_month', 'estimated_remaining_distance_this_month', 'verbleibende_strecke_diesen_monat', 'verbleibende_km_diesen_monat'] },
        { key: 'remaining_year', terms: ['remaining_distance_this_year', 'estimated_remaining_distance_this_year', 'verbleibende_strecke_dieses_jahr', 'verbleibende_km_dieses_jahr'] },
        { key: 'remaining_total', terms: ['remaining_distance_total', 'verbleibende_strecke_gesamt', 'verbleibende_km_gesamt'] },
        { key: 'driven', terms: ['total_distance_driven', 'gefahrene_strecke', 'gefahrene_km'] },
        { key: 'difference', terms: ['distance_difference_to_plan', 'strecken_differenz_zum_plan', 'km_differenz_zum_plan'] },
        { key: 'progress', terms: ['progress', 'fortschritt'] },
        { key: 'avg_day', terms: ['average_distance_per_day', 'durchschnittliche_strecke_pro_tag', 'durchschnitt_km_pro_tag'] },
        { key: 'avg_month', terms: ['average_distance_per_month', 'durchschnittliche_strecke_pro_monat', 'durchschnitt_km_pro_monat'] },
        { key: 'days', terms: ['remaining_days', 'verbleibende_tage'] },
      ];

      Object.keys(hass.states).forEach((entityId) => {
        if (!entityId.startsWith('sensor.')) return;
        if (!entityId.includes(baseName)) return;

        for (const { key, terms } of PATTERNS) {
          if (found[key]) continue;
          if (terms.some((t) => entityId.includes(t))) {
            found[key] = hass.states[entityId];
            break;
          }
        }
      });
    }

    return found;
  }

  renderHeader(sensors) {
    const showTitle = this._config.show_title !== false;
    const showStatus = this._config.show_status !== false;
    
    // Wenn beides ausgeblendet ist, keinen Header anzeigen
    if (!showTitle && !showStatus) {
      return '';
    }
    
    const rawStatus = sensors.status?.state || 'unknown';
    const status = this.translateStatus(rawStatus);
    const statusColor = this.getStatusColor(rawStatus);
    
    // Nur Status ohne Titel
    if (!showTitle && showStatus) {
      return `
        <div class="card-header status-only">
          <div class="icon-wrapper" style="background: ${statusColor}20;">
            <ha-icon icon="mdi:car-info" style="color: ${statusColor};"></ha-icon>
          </div>
          <div class="status-badge" style="background: ${statusColor}30; color: ${statusColor};">
            ${status}
          </div>
        </div>
      `;
    }
    
    // Titel mit oder ohne Status
    return `
      <div class="card-header">
        <div class="icon-wrapper" style="background: ${statusColor}20;">
          <ha-icon icon="mdi:car-info" style="color: ${statusColor};"></ha-icon>
        </div>
        <div class="header-text">
          <div class="title">${this._config.title || 'Leasing Tracker'}</div>
          ${showStatus ? `
            <div class="status-badge" style="background: ${statusColor}30; color: ${statusColor};">
              ${status}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  translateStatus(status) {
    // Übersetzt die Status-Keys der neuen Integration ins Deutsche.
    // Akzeptiert auch bereits übersetzte Werte (Rückwärtskompatibilität).
    const map = {
      on_plan: 'Im Plan',
      over_plan: 'Über Plan',
      significantly_over_plan: 'Deutlich über Plan',
      under_plan: 'Unter Plan',
      unknown: 'Unbekannt',
      unavailable: 'Nicht verfügbar',
    };
    return map[status] || status;
  }

  renderContent(sensors) {
    const config = this._config;
    let html = '<div class="metrics">';
    
    // Verbleibende KM Monat
    if (config.show_km_remaining_month !== false && sensors.remaining_month) {
      html += this.renderMetric(
        'Verbleibend (Monat)',
        sensors.remaining_month,
        'mdi:calendar-month',
        this.getKmColor(sensors.remaining_month.state)
      );
    }
    
    // Verbleibende KM Jahr
    if (config.show_km_remaining_year !== false && sensors.remaining_year) {
      html += this.renderMetric(
        'Verbleibend (Jahr)',
        sensors.remaining_year,
        'mdi:calendar-clock',
        this.getKmColor(sensors.remaining_year.state)
      );
    }
    
    // Verbleibende KM Gesamt
    if (config.show_km_remaining_total !== false && sensors.remaining_total) {
      html += this.renderMetric(
        'Verbleibend (Gesamt)',
        sensors.remaining_total,
        'mdi:counter',
        'var(--primary-color)'
      );
    }
    
    // Gefahrene Strecke
    if (config.show_km_driven !== false && sensors.driven) {
      html += this.renderMetric(
        'Gefahrene Strecke',
        sensors.driven,
        'mdi:speedometer',
        'var(--info-color)'
      );
    }
    
    // Differenz
    if (config.show_km_difference !== false && sensors.difference) {
      html += this.renderMetric(
        'Differenz zum Plan',
        sensors.difference,
        'mdi:delta',
        this.getDifferenceColor(sensors.difference.state)
      );
    }
    
    // Durchschnitt Tag
    if (config.show_average_day !== false && sensors.avg_day) {
      html += this.renderMetric(
        'Ø pro Tag',
        sensors.avg_day,
        'mdi:chart-line',
        'var(--warning-color)'
      );
    }
    
    // Durchschnitt Monat
    if (config.show_average_month !== false && sensors.avg_month) {
      html += this.renderMetric(
        'Ø pro Monat',
        sensors.avg_month,
        'mdi:chart-bar',
        'var(--warning-color)'
      );
    }
    
    // Verbleibende Tage
    if (config.show_remaining_days !== false && sensors.days) {
      html += this.renderMetric(
        'Verbleibende Tage',
        sensors.days,
        'mdi:calendar-end',
        'var(--secondary-text-color)'
      );
    }
    
    html += '</div>';
    
    // Fortschritt
    if (config.show_progress !== false && sensors.progress) {
      html += this.renderProgress(sensors.progress);
    }
    
    return html;
  }

  renderMetric(label, entity, icon, color) {
    const value = this.formatNumber(entity.state);
    const unit = entity.attributes.unit_of_measurement || '';
    
    return `
      <div class="metric" data-entity="${entity.entity_id}">
        <div class="metric-icon" style="background: ${color}20;">
          <ha-icon icon="${icon}" style="color: ${color};"></ha-icon>
        </div>
        <div class="metric-content">
          <div class="metric-label">${label}</div>
          <div class="metric-value" style="color: ${color};">
            ${value} <span class="unit">${unit}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderProgress(entity) {
    const progress = Math.min(100, Math.max(0, parseFloat(entity.state)));
    const color = progress > 90 ? 'var(--error-color)' : 
                  progress > 70 ? 'var(--warning-color)' : 
                  'var(--success-color)';
    
    return `
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">Zeitfortschritt</span>
          <span class="progress-percent">${progress.toFixed(1)}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%; background: ${color};"></div>
        </div>
      </div>
    `;
  }

  formatNumber(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    
    if (Math.abs(num) >= 1000) {
      return num.toLocaleString('de-DE', { maximumFractionDigits: 0 });
    }
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  }

  getStatusColor(status) {
    const colors = {
      // Neue Status-Keys
      on_plan: 'var(--success-color)',
      over_plan: 'var(--warning-color)',
      significantly_over_plan: 'var(--error-color)',
      under_plan: 'var(--info-color)',
      // Alte (übersetzte) Werte – Rückwärtskompatibilität
      'Im Plan': 'var(--success-color)',
      'Über Plan': 'var(--warning-color)',
      'Deutlich über Plan': 'var(--error-color)',
      'Unter Plan': 'var(--info-color)',
    };
    return colors[status] || 'var(--primary-color)';
  }

  getKmColor(km) {
    const value = parseFloat(km);
    if (isNaN(value)) return 'var(--primary-text-color)';
    if (value < 0) return 'var(--error-color)';
    if (value < 500) return 'var(--warning-color)';
    return 'var(--success-color)';
  }

  getDifferenceColor(diff) {
    const value = parseFloat(diff);
    if (isNaN(value)) return 'var(--primary-text-color)';
    if (value > 1000) return 'var(--error-color)';
    if (value > 0) return 'var(--warning-color)';
    return 'var(--success-color)';
  }

  fire(type, detail) {
    const event = new Event(type, {
      bubbles: true,
      composed: true,
    });
    event.detail = detail;
    this.dispatchEvent(event);
  }

  getStyles() {
    return `
      <style>
        ha-card {
          padding: 16px;
        }
        
        .card-header {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--divider-color);
        }
        
        .card-header.status-only {
          gap: 12px;
        }
        
        .card-header.status-only .status-badge {
          font-size: 1em;
        }
        
        .icon-wrapper {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }
        
        .icon-wrapper ha-icon {
          --mdc-icon-size: 32px;
        }
        
        .header-text {
          flex: 1;
        }
        
        .title {
          font-size: 1.5em;
          font-weight: 500;
          margin-bottom: 6px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85em;
          font-weight: 500;
        }
        
        .metrics {
          display: grid !important;
          grid-template-columns: repeat(var(--leasing-columns, 2), minmax(0, 1fr)) !important;
          gap: 12px;
          margin-bottom: 16px;
          container-type: inline-size;
        }
        
        /* Fallback für Viewport-Breite */
        @media (max-width: 600px) {
          .metrics {
            grid-template-columns: repeat(var(--leasing-columns-mobile, 1), minmax(0, 1fr)) !important;
          }
        }
        
        .metric {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: var(--leasing-metric-bg, var(--secondary-background-color));
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        
        .metric:hover {
          background: var(--leasing-metric-bg-hover, var(--divider-color));
          transform: translateY(-2px);
        }
        
        .metric-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          flex-shrink: 0;
        }
        
        .metric-icon ha-icon {
          --mdc-icon-size: 24px;
        }
        
        .metric-content {
          flex: 1;
          min-width: 0;
        }
        
        .metric-label {
          font-size: 0.85em;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        @media (max-width: 600px) {
          .metric-label {
            font-size: 0.75em;
          }
          .metric-value {
            font-size: 1.1em;
          }
          .metric-icon {
            width: 32px;
            height: 32px;
          }
          .metric-icon ha-icon {
            --mdc-icon-size: 20px;
          }
          .metric {
            padding: 10px;
            gap: 8px;
          }
        }
        
        .metric-value {
          font-size: 1.3em;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .unit {
          font-size: 0.7em;
          font-weight: 400;
          opacity: 0.7;
        }
        
        .progress-section {
          margin-top: 8px;
          padding: 16px;
          background: var(--leasing-metric-bg, var(--secondary-background-color));
          border-radius: 8px;
        }
        
        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .progress-label {
          font-size: 0.9em;
          color: var(--secondary-text-color);
        }
        
        .progress-percent {
          font-weight: 600;
          color: var(--primary-text-color);
        }
        
        .progress-bar {
          height: 8px;
          background: var(--divider-color);
          border-radius: 4px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
      </style>
    `;
  }

  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement('leasing-tracker-card-editor');
  }

  static getStubConfig(hass) {
    // Versuche automatisch einen Status-Sensor der Integration zu finden
    let entity = 'sensor.leasing_status';
    if (hass && hass.states) {
      const candidate = Object.keys(hass.states).find(
        (id) => id.startsWith('sensor.') && id.endsWith('_status')
      );
      if (candidate) entity = candidate;
    }
    return {
      entity: entity,
      show_title: true,
      show_status: true,
    };
  }
}

customElements.define('leasing-tracker-card', LeasingTrackerCard);

/* =========================================================================
 *  VISUELLER EDITOR
 * ========================================================================= */
class LeasingTrackerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    if (this._hass) {
      this.render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config && !this._rendered) {
      this.render();
    }
  }

  _valueChanged(key, value) {
    if (!this._config) return;
    // Standardwerte nicht unnötig speichern
    this._config = { ...this._config, [key]: value };
    const event = new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    if (!this._config || !this._hass) return;

    const switches = [
      { key: 'show_title', label: 'Titel anzeigen' },
      { key: 'show_status', label: 'Status anzeigen' },
      { key: 'show_km_remaining_month', label: 'Verbleibend (Monat)' },
      { key: 'show_km_remaining_year', label: 'Verbleibend (Jahr)' },
      { key: 'show_km_remaining_total', label: 'Verbleibend (Gesamt)' },
      { key: 'show_km_driven', label: 'Gefahrene Strecke' },
      { key: 'show_km_difference', label: 'Differenz zum Plan' },
      { key: 'show_average_day', label: 'Ø pro Tag' },
      { key: 'show_average_month', label: 'Ø pro Monat' },
      { key: 'show_remaining_days', label: 'Verbleibende Tage' },
      { key: 'show_progress', label: 'Fortschrittsbalken' },
    ];

    const container = document.createElement('div');
    container.className = 'card-config';
    container.innerHTML = `
      <style>
        .card-config { padding: 8px 0; }
        .section {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .section-title {
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--primary-text-color);
        }
        .option { margin-bottom: 16px; }
        .option:last-child { margin-bottom: 0; }
        .switch-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--divider-color);
        }
        .switch-row:last-child { border-bottom: none; }
        .switch-label { color: var(--primary-text-color); }
        ha-entity-picker, ha-textfield { width: 100%; display: block; }
        .hint {
          font-size: 0.85em;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }
        .row2 { display: flex; gap: 12px; }
        .row2 > * { flex: 1; }
      </style>

      <div class="section">
        <div class="section-title">Basis-Einstellungen</div>
        <div class="option" id="entity-slot"></div>
        <div class="option">
          <ha-textfield id="title-field" label="Titel" value="${(this._config.title || '').replace(/"/g, '&quot;')}"></ha-textfield>
          <div class="hint">Leer lassen für Standard ("Leasing Tracker")</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Layout</div>
        <div class="row2">
          <ha-textfield id="columns-field" type="number" min="1" max="4" label="Spalten (Desktop)" value="${this._config.columns ?? 2}"></ha-textfield>
          <ha-textfield id="columns-mobile-field" type="number" min="1" max="4" label="Spalten (Mobil)" value="${this._config.columns_mobile ?? 1}"></ha-textfield>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Anzuzeigende Elemente</div>
        ${switches
          .map(
            (s) => `
          <div class="switch-row">
            <span class="switch-label">${s.label}</span>
            <ha-switch data-key="${s.key}" ${this._config[s.key] !== false ? 'checked' : ''}></ha-switch>
          </div>`
          )
          .join('')}
      </div>
    `;

    this.innerHTML = '';
    this.appendChild(container);

    // Entity Picker (programmatisch, damit .hass korrekt gesetzt wird)
    const entityPicker = document.createElement('ha-entity-picker');
    entityPicker.hass = this._hass;
    entityPicker.value = this._config.entity || '';
    entityPicker.label = 'Status-Sensor (erforderlich)';
    entityPicker.includeDomains = ['sensor'];
    entityPicker.allowCustomEntity = true;
    entityPicker.addEventListener('value-changed', (e) => {
      this._valueChanged('entity', e.detail.value);
    });
    container.querySelector('#entity-slot').appendChild(entityPicker);

    // Titel
    const titleField = container.querySelector('#title-field');
    titleField.addEventListener('input', (e) => {
      this._valueChanged('title', e.target.value);
    });

    // Spalten
    const columnsField = container.querySelector('#columns-field');
    columnsField.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      this._valueChanged('columns', isNaN(v) ? 2 : v);
    });
    const columnsMobileField = container.querySelector('#columns-mobile-field');
    columnsMobileField.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      this._valueChanged('columns_mobile', isNaN(v) ? 1 : v);
    });

    // Schalter
    container.querySelectorAll('ha-switch[data-key]').forEach((sw) => {
      sw.addEventListener('change', (e) => {
        this._valueChanged(e.target.dataset.key, e.target.checked);
      });
    });

    this._rendered = true;
  }
}

customElements.define('leasing-tracker-card-editor', LeasingTrackerCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'leasing-tracker-card',
  name: 'Leasing Tracker Card',
  description: 'Eine schöne Card für die Leasing Tracker Integration',
  preview: true,
  documentationURL:
    'https://github.com/foxxxhater/hacs_leasing_tracker_card',
});

console.info(
  '%c  LEASING-TRACKER-CARD  %c v1.2.0 ',
  'color: white; background: #4A90E2; font-weight: 700;',
  'color: #4A90E2; background: white; font-weight: 700;'
);
