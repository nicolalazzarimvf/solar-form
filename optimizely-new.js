(function () {
  'use strict';
  /* optimizely-new.js — copy of optimizely.js for a separate Optimizely experiment; use one of optimizely.js / optimizely-new.js per variation, not both on the same page. */

  window.__solarOptlyChangesAppliedCount =
    (window.__solarOptlyChangesAppliedCount || 0) + 1;

  if (window.__solarOptlyThankYouScriptLoaded) return;

  (function injectEarlyHideMainPageRows() {
    if (document.getElementById('solar-optly-early-hide')) return;
    var s = document.createElement('style');
    s.id = 'solar-optly-early-hide';
    s.textContent =
      'div.vc_row.wpb_row.vc_row-fluid.background-position-center-center:nth-of-type(1),' +
      'div.vc_row.wpb_row.vc_row-fluid.background-position-center-center:nth-of-type(3)' +
      '{display:none!important}';
    (document.head || document.documentElement).appendChild(s);
  })();

  (function redirectOrgSolarToAppointmentBooking() {
    var loc = window.location || {};
    var path = String(loc.pathname || '');
    var appointmentSeg = '/appointment-booking-form/sp-uk';
    if (
      path.indexOf('/org-solar') !== -1 &&
      path.indexOf(appointmentSeg) === -1
    ) {
      window.location.replace(
        loc.origin + appointmentSeg + (loc.search || '') + (loc.hash || '')
      );
      return;
    }
  })();

  window.__solarOptlyThankYouScriptLoaded = true;

  var CONFIG = {
    appUrl:
      'https://solar-form-eight.vercel.app/loader',
    typPathContains: '/typ/project-solar/appointment/sp-uk/',
    typPathContainsAppointmentBooking: '/appointment-booking-form/sp-uk',
    debug: false,
    maxWaitMs: 30000,
    pollMs: 250,
    eligibilityStorageKey: 'solar_optly_eligible_submission',
    eligibilityTtlMs: 30 * 60 * 1000,
    iframeIdPrefix: 'mvfFormWidget-',
    hiddenMainPageRowSelector:
      'div.vc_row.wpb_row.vc_row-fluid.background-position-center-center',
    hiddenMainPageRowIndexes: [0, 2], // Hide/show only 1st and 3rd matches
    heightDebug: false,
    getAvailabilityApiUrl: 'https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1',
    getAvailabilityApiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlanBianFqZnhtZWh5dmx3ZWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI2MzMwODYsImV4cCI6MjA0ODIwOTA4Nn0.8pFmhFXMPhVPkSHnVJlWDuey0FUFa0dHHkT8yvYbNJs',
    // Parent-page fetch can exceed 5s (edge cold start, TLS); race was marking no_slots falsely
    slotCheckTimeoutMs: 15000,
    allowedOutwardCodesUrl:
      'https://solar-form-eight.vercel.app/allowed-outward-codes.json',
    appointmentsApiUrl: 'https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1/appointments',
    appointmentsApiKey: '5FVpsEtJ77rQoH3hD8jxPZSI6kIZx5WYlvvw98mRCUfvTh9yFdLXiRdFRV8cTA1O',
    requiredAnswers: {
      // Accept multiple variants because Chameleon configs can emit either label text
      // (e.g. "homeowner") or binary values (e.g. "yes"/"no").
      'a2f8b4ab-f96c-11e4-824b-22000a699fb3': ['homeowner', 'yes'],
      '128a72ad-041e-11ed-a6b2-062f1bcd6de3': ['home'],
      'a6c8cf0f-995a-11e7-bbea-02e4563f24a3': ['no'],
      'b9f10adf-995a-11e7-bbea-02e4563f24a3': ['no'],
    },
    disqualifyingAnswers: {
      '38eafe61-cde6-11ef-8147-026b0caa8275': ['apartment'],
    },
    projectSolarLogoUrl:
      'https://images-ulpn.ecs.prd9.eu-west-1.mvfglobal.net/wp-content/uploads/2025/10/Project-Solar-long-full-colour-without-tag.svg',
  };

  // Override from window.__solarOptlyConfig (set before script loads)
  if (typeof window.__solarOptlyConfig === 'object' && window.__solarOptlyConfig !== null) {
    for (var k in window.__solarOptlyConfig) {
      if (Object.prototype.hasOwnProperty.call(window.__solarOptlyConfig, k)) {
        CONFIG[k] = window.__solarOptlyConfig[k];
      }
    }
  }

  // Enable debug when URL has debug=true (e.g. ?debug=true or &debug=true)
  (function () {
    var search = (window.location && window.location.search) || '';
    var params = new URLSearchParams(search);
    if (params.get('debug') === 'true' || params.get('debug') === '1') {
      CONFIG.debug = true;
    }
  })();

  function log() {
    if (!CONFIG.debug) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Solar Optimizely]');
    try {
      console.log.apply(console, args);
    } catch (e) {
      // no-op
    }
  }

  function heightLog() {
    if (!CONFIG.heightDebug) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Solar Optimizely Height]');
    try {
      console.log.apply(console, args);
    } catch (e) {
      // no-op
    }
  }

  function hasAnswersInDataLayer() {
    return !!getAnswersFromDataLayer();
  }

  function getAnswersFromDataLayer() {
    var dl = window.dataLayer;
    if (!dl) return null;
    if (dl.answers && typeof dl.answers === 'object') return dl.answers;
    for (var i = dl.length - 1; i >= 0; i--) {
      if (dl[i] && dl[i].answers && typeof dl[i].answers === 'object') return dl[i].answers;
    }
    return null;
  }

  function ensureDebugPopup() {
    if (!CONFIG.debug) return null;
    if (!document.body) return null;
    var id = 'solar-optly-debug-panel';
    var el = document.getElementById(id);
    if (el) return el;

    el = document.createElement('div');
    el.id = id;
    el.style.cssText =
      'position:fixed;top:12px;right:12px;width:320px;max-height:70vh;overflow:auto;' +
      'background:#1a1a2e;color:#eee;font:11px/1.4 monospace;padding:10px;' +
      'border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.4);z-index:999999;' +
      'border:1px solid #333;';
    document.body.appendChild(el);
    return el;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  var __debugPopupLastContent = '';

  function updateDebugPopup() {
    var el = ensureDebugPopup();
    if (!el) return;

    var answers = getAnswersFromDataLayer();
    var answersRow = answers
      ? '<div style="background:#c0392b;color:#fff;padding:6px 10px;margin:-10px -10px 10px -10px;border-radius:8px 8px 0 0;font-weight:600;font-size:12px;">answers collected</div>'
      : '';

    var answersHtml = '';
    if (answers) {
      var keys = Object.keys(answers);
      answersHtml = keys.map(function (k) {
        var v = answers[k];
        var valStr = v === null || v === undefined ? '' : String(v);
        if (valStr.length > 40) valStr = valStr.slice(0, 37) + '...';
        return '<div style="margin:4px 0;padding:4px;background:#2d2d44;border-radius:4px;font-size:10px;">' +
          '<span style="color:#9ecba7">' + escapeHtml(k) + '</span>: ' + escapeHtml(valStr) +
          '</div>';
      }).join('');
    }

    var slotHtml = '';
    var slotResult = window.__solarOptlySlotCheckResult;
    var slotPcForUi = '';
    if (slotResult && slotResult.postcode) {
      slotPcForUi = slotResult.postcode;
    } else if (window.__solarOptlySlotCheckInFlight && window.__solarOptlySlotCheckPostcode) {
      slotPcForUi = window.__solarOptlySlotCheckPostcode;
    }
    var slotAvailUrl = '';
    if (slotPcForUi && CONFIG.getAvailabilityApiUrl) {
      slotAvailUrl = CONFIG.getAvailabilityApiUrl + '/get-availability?postcode=' + encodeURIComponent(slotPcForUi);
    }
    var slotMetaHtml = '';
    if (slotPcForUi) {
      slotMetaHtml +=
        '<div style="font-size:9px;color:#888;margin-top:6px;">postcode <span style="color:#ccc;">' + escapeHtml(slotPcForUi) + '</span></div>';
    }
    if (slotAvailUrl) {
      slotMetaHtml +=
        '<div style="font-size:9px;color:#9ecba7;margin-top:6px;">GET (availability)</div>' +
        '<div style="font-size:9px;color:#ccc;word-break:break-all;line-height:1.35;">' + escapeHtml(slotAvailUrl) + '</div>';
    }
    if (slotResult) {
      var slotColor = slotResult.hasSlots ? '#27ae60' : '#c0392b';
      var slotLabel = slotResult.hasSlots ? 'YES' : 'NO';
      var slotDetail = '';
      if (slotResult.error) {
        slotDetail = slotResult.error;
      } else {
        slotDetail = slotResult.totalSlots + ' slots across ' + slotResult.days + ' days';
      }
      slotHtml =
        '<div style="margin:8px 0;padding:8px;background:#2d2d44;border-radius:6px;">' +
        '<div style="font-weight:600;font-size:11px;margin-bottom:4px;">Slot Check</div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        '<span style="background:' + slotColor + ';color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;">' + slotLabel + '</span>' +
        '<span style="font-size:10px;color:#aaa;">' + escapeHtml(slotDetail) + '</span>' +
        '</div>' + slotMetaHtml + '</div>';
    } else if (window.__solarOptlySlotCheckInFlight) {
      slotHtml =
        '<div style="margin:8px 0;padding:8px;background:#2d2d44;border-radius:6px;">' +
        '<div style="font-weight:600;font-size:11px;">Slot Check</div>' +
        '<div style="font-size:10px;color:#f1c40f;margin-top:4px;">checking...</div>' +
        slotMetaHtml + '</div>';
    }

    var endpointsHtml = '';
    var apptSid = getSubmissionId();
    var apptBase = CONFIG.appointmentsApiUrl;
    if (apptSid) {
      endpointsHtml =
        '<div style="margin:8px 0;padding:8px;background:#2d2d44;border-radius:6px;">' +
        '<div style="font-weight:600;font-size:11px;margin-bottom:6px;">Appointment endpoints</div>' +
        '<div style="font-size:9px;color:#ccc;line-height:1.45;word-break:break-all;">' +
        '<div style="color:#9ecba7;">POST (progress / success)</div>' +
        '<div>' + escapeHtml(apptBase + '/' + encodeURIComponent(apptSid)) + '</div>' +
        '<div style="color:#9ecba7;margin-top:6px;">POST (failed)</div>' +
        '<div>' + escapeHtml(apptBase + '/' + encodeURIComponent(apptSid) + '/failed') + '</div>' +
        '<div style="color:#9ecba7;margin-top:6px;">GET (status)</div>' +
        '<div>' + escapeHtml(apptBase + '/' + encodeURIComponent(apptSid)) + '</div>' +
        '</div></div>';
    } else {
      endpointsHtml =
        '<div style="margin:8px 0;padding:8px;background:#2d2d44;border-radius:6px;">' +
        '<div style="font-weight:600;font-size:11px;margin-bottom:6px;">Appointment endpoints</div>' +
        '<div style="font-size:9px;color:#888;">No submissionId yet (templates):</div>' +
        '<div style="font-size:9px;color:#ccc;margin-top:4px;line-height:1.45;word-break:break-all;">' +
        '<div style="color:#9ecba7;">POST</div>' +
        '<div>' + escapeHtml(apptBase + '/{id}') + '</div>' +
        '<div style="color:#9ecba7;margin-top:6px;">POST (failed)</div>' +
        '<div>' + escapeHtml(apptBase + '/{id}/failed') + '</div>' +
        '<div style="color:#9ecba7;margin-top:6px;">GET</div>' +
        '<div>' + escapeHtml(apptBase + '/{id}') + '</div>' +
        '</div></div>';
    }

    var appointmentHtml = '';
    var appointmentLog = window.__solarOptlyAppointmentLog || [];
    if (appointmentLog.length > 0) {
      var logItems = appointmentLog.map(function (entry, idx) {
        var statusColors = { progressing: '#f1c40f', successful: '#27ae60', failed: '#c0392b', GET: '#4dabf7' };
        var resultColors = { ok: '#27ae60', error: '#c0392b', pending: '#888' };
        var statusColor = statusColors[entry.status] || '#888';
        var resultColor = resultColors[entry.result] || '#888';
        var timeStr = entry.ts ? entry.ts.split('T')[1].split('.')[0] : '';
        var resultDetail = entry.result === 'error' ? (' ' + escapeHtml(entry.error || '')) : '';
        if (entry.httpStatus) resultDetail += ' [' + entry.httpStatus + ']';

        var detailId = 'solar-appt-detail-' + idx;
        var reqJson = '';
        try { reqJson = JSON.stringify(entry.requestBody, null, 1); } catch (e) { reqJson = '(unavailable)'; }
        var resJson = '';
        if (entry.response) {
          try { resJson = JSON.stringify(entry.response, null, 1); } catch (e) { resJson = '(parse error)'; }
        } else if (entry.result === 'pending') {
          resJson = '(pending)';
        } else if (entry.error) {
          resJson = entry.error;
        }

        return '<div style="margin:2px 0;background:#1a1a2e;border-radius:3px;font-size:9px;">' +
          '<div style="padding:3px 6px;display:flex;align-items:center;gap:4px;cursor:pointer;" onclick="var d=document.getElementById(\'' + detailId + '\');d.style.display=d.style.display===\'none\'?\'block\':\'none\';">' +
          '<span style="color:#666;min-width:50px;">' + escapeHtml(timeStr) + '</span>' +
          '<span style="background:' + statusColor + ';color:#000;padding:1px 5px;border-radius:3px;font-weight:700;font-size:8px;text-transform:uppercase;">' + escapeHtml(entry.status) + '</span>' +
          '<span style="color:#aaa;">' + escapeHtml(entry.step) + '</span>' +
          '<span style="color:' + resultColor + ';margin-left:auto;font-size:8px;">' + escapeHtml(entry.result) + resultDetail + '</span>' +
          '<span style="color:#666;font-size:8px;">&#9660;</span>' +
          '</div>' +
          '<div id="' + detailId + '" style="display:none;padding:4px 6px;border-top:1px solid #333;">' +
          '<div style="color:#9ecba7;font-size:8px;font-weight:600;margin-bottom:2px;">Request:</div>' +
          '<pre style="margin:0;color:#ccc;font-size:8px;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow:auto;">' + escapeHtml(reqJson) + '</pre>' +
          '<div style="color:#9ecba7;font-size:8px;font-weight:600;margin:4px 0 2px;">Response:</div>' +
          '<pre style="margin:0;color:#ccc;font-size:8px;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow:auto;">' + escapeHtml(resJson) + '</pre>' +
          '</div></div>';
      }).join('');
      appointmentHtml =
        '<div style="margin:8px 0;padding:8px;background:#2d2d44;border-radius:6px;">' +
        '<div style="font-weight:600;font-size:11px;margin-bottom:4px;">Appointment API (' + appointmentLog.length + ')</div>' +
        '<div style="max-height:250px;overflow:auto;">' + logItems + '</div>' +
        '</div>';
    }

    var newContent =
      '<div style="margin-bottom:8px;font-weight:700;color:#9ecba7;">Solar Debug</div>' +
      answersRow +
      slotHtml +
      endpointsHtml +
      appointmentHtml +
      (answersHtml ? '<div style="margin-top:8px;max-height:200px;overflow:auto;">' + answersHtml + '</div>' : '');

    if (newContent === __debugPopupLastContent) return;
    // Preserve expanded appointment detail panels across re-renders
    var expandedPanels = {};
    var detailEls = el.querySelectorAll('[id^="solar-appt-detail-"]');
    for (var d = 0; d < detailEls.length; d++) {
      if (detailEls[d].style.display !== 'none') {
        expandedPanels[detailEls[d].id] = true;
      }
    }
    __debugPopupLastContent = newContent;
    el.innerHTML = newContent;
    // Restore expanded state
    for (var panelId in expandedPanels) {
      if (Object.prototype.hasOwnProperty.call(expandedPanels, panelId)) {
        var panel = document.getElementById(panelId);
        if (panel) panel.style.display = 'block';
      }
    }
  }

  function normalize(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function now() {
    return Date.now();
  }

  function isTypUrl() {
    var href = String(
      window.location && window.location.href ? window.location.href : ''
    );
    return (
      href.indexOf(CONFIG.typPathContains) !== -1 ||
      href.indexOf(CONFIG.typPathContainsAppointmentBooking) !== -1
    );
  }

  function persistEligibilityMarker() {
    var payload = {
      matchedAt: now(),
      prefillPostcode: window.__solarOptlyPrefillPostcode || '',
      prefillFirstName: window.__solarOptlyPrefillFirstName || '',
      prefillAnswers: window.__solarOptlyPrefillAnswers || {},
    };
    try {
      log('Persisting eligibility marker', {
        key: CONFIG.eligibilityStorageKey,
        payload: payload,
      });
      sessionStorage.setItem(
        CONFIG.eligibilityStorageKey,
        JSON.stringify(payload)
      );
    } catch (e) {
      log('Failed to persist eligibility marker', e);
    }
  }

  function consumeEligibilityMarkerIfFresh() {
    try {
      var raw = sessionStorage.getItem(CONFIG.eligibilityStorageKey);
      if (!raw) {
        log('No eligibility marker found in sessionStorage');
        return null;
      }
      var parsed = JSON.parse(raw);
      var isFresh =
        parsed &&
        typeof parsed.matchedAt === 'number' &&
        now() - parsed.matchedAt <= CONFIG.eligibilityTtlMs;
      log('Eligibility marker read', {
        raw: raw,
        isFresh: isFresh,
        ageMs:
          parsed && typeof parsed.matchedAt === 'number'
            ? now() - parsed.matchedAt
            : null,
      });
      sessionStorage.removeItem(CONFIG.eligibilityStorageKey);
      return isFresh ? parsed : null;
    } catch (e) {
      log('Error reading eligibility marker', e);
      try {
        sessionStorage.removeItem(CONFIG.eligibilityStorageKey);
      } catch (ignore) {
        log('Error clearing broken eligibility marker', ignore);
      }
      return null;
    }
  }

  function extractAnswerValue(answers, sugarId) {
    if (!answers || typeof answers !== 'object') return '';

    var directKey = 'answers[' + sugarId + ']';
    if (Object.prototype.hasOwnProperty.call(answers, directKey)) {
      return answers[directKey];
    }
    if (Object.prototype.hasOwnProperty.call(answers, sugarId)) {
      return answers[sugarId];
    }
    return '';
  }

  function isEligible(answers) {
    if (!answers || typeof answers !== 'object') return false;

    var requiredIds = Object.keys(CONFIG.requiredAnswers);
    for (var i = 0; i < requiredIds.length; i += 1) {
      var id = requiredIds[i];
      var expectedListRaw = CONFIG.requiredAnswers[id];
      var expectedList = Array.isArray(expectedListRaw)
        ? expectedListRaw.map(normalize)
        : [normalize(expectedListRaw)];
      var actual = normalize(extractAnswerValue(answers, id));
      log('Evaluating answer', {
        sugarId: id,
        expectedAnyOf: expectedList,
        actual: actual,
      });
      if (expectedList.indexOf(actual) === -1) {
        log(
          'Mismatch for',
          id,
          'expected one of',
          expectedList.join(', '),
          'received',
          actual
        );
        return false;
      }
    }

    var disqualIds = Object.keys(CONFIG.disqualifyingAnswers || {});
    for (var j = 0; j < disqualIds.length; j += 1) {
      var dqId = disqualIds[j];
      var blocklist = Array.isArray(CONFIG.disqualifyingAnswers[dqId])
        ? CONFIG.disqualifyingAnswers[dqId].map(normalize)
        : [normalize(CONFIG.disqualifyingAnswers[dqId])];
      var dqActual = normalize(extractAnswerValue(answers, dqId));
      log('Evaluating disqualifier', { sugarId: dqId, blocklist: blocklist, actual: dqActual });
      if (dqActual && blocklist.indexOf(dqActual) !== -1) {
        log('Disqualified by', dqId, 'answer', dqActual, 'is in blocklist', blocklist.join(', '));
        return false;
      }
    }

    return true;
  }

  function getTargetIframe(preferredIFrameId) {
    if (preferredIFrameId) {
      var exact = document.getElementById(preferredIFrameId);
      if (exact && exact.tagName === 'IFRAME') return exact;
    }

    var prefixed = document.querySelector(
      'iframe[id^="' + CONFIG.iframeIdPrefix + '"]'
    );
    return prefixed || null;
  }

  function extractTextFromAnswers(answers, keys) {
    if (!answers || typeof answers !== 'object') return '';
    for (var i = 0; i < keys.length; i += 1) {
      var val = answers[keys[i]] || answers['answers[' + keys[i] + ']'];
      if (val && String(val).trim()) {
        return String(val).trim();
      }
    }
    return '';
  }

  /** Fallback: scan answer keys by regex for Chameleon sugar IDs / alternate keys */
  function extractByKeyPattern(answers, pattern) {
    if (!answers || typeof answers !== 'object') return '';
    for (var k in answers) {
      if (
        Object.prototype.hasOwnProperty.call(answers, k) &&
        pattern.test(k) &&
        answers[k] &&
        String(answers[k]).trim()
      ) {
        return String(answers[k]).trim();
      }
    }
    return '';
  }

  function extractPostcodeFromAnswers(answers) {
    if (!answers || typeof answers !== 'object') return '';
    var keys = [
      'primary_address_postalcode',
      'primary_address_postcode',
      'postcode',
      'answers[primary_address_postalcode]',
    ];
    for (var i = 0; i < keys.length; i += 1) {
      var val = answers[keys[i]] || answers['answers[' + keys[i] + ']'];
      if (val && String(val).trim()) {
        return String(val).trim().replace(/\s/g, '').toUpperCase();
      }
    }
    // Fallback: scan for any key containing postcode/postal
    for (var k in answers) {
      if (
        Object.prototype.hasOwnProperty.call(answers, k) &&
        /postcode|postal/i.test(k) &&
        answers[k] &&
        String(answers[k]).trim()
      ) {
        return String(answers[k]).trim().replace(/\s/g, '').toUpperCase();
      }
    }
    return '';
  }

  function extractUkOutwardCode(normalizedPostcode) {
    var pc = String(normalizedPostcode || '').replace(/\s/g, '').toUpperCase();
    if (pc.length < 5) return '';
    return pc.slice(0, -3);
  }

  function loadAllowedOutwardSet() {
    if (window.__solarOptlyAllowedOutwardMap) {
      return Promise.resolve(window.__solarOptlyAllowedOutwardMap);
    }
    if (window.__solarOptlyAllowedOutwardPromise) {
      return window.__solarOptlyAllowedOutwardPromise;
    }
    var url = CONFIG.allowedOutwardCodesUrl;
    window.__solarOptlyAllowedOutwardPromise = fetch(url, { credentials: 'omit', cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('allowed list HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        var list = data.outward;
        if (!Array.isArray(list)) {
          throw new Error('allowed list invalid JSON');
        }
        var map = {};
        for (var i = 0; i < list.length; i += 1) {
          map[String(list[i]).toUpperCase()] = true;
        }
        window.__solarOptlyAllowedOutwardMap = map;
        window.__solarOptlyAllowedOutwardPromise = null;
        log('Loaded allowed outward postcode count', list.length);
        return map;
      })
      .catch(function (err) {
        window.__solarOptlyAllowedOutwardPromise = null;
        log('Failed to load allowed outward codes', err);
        throw err;
      });
    return window.__solarOptlyAllowedOutwardPromise;
  }

  function checkSlotsAvailable(postcode) {
    if (!postcode || typeof postcode !== 'string' || !postcode.trim()) {
      return Promise.resolve(false);
    }
    var pc = postcode.trim().replace(/\s/g, '');
    window.__solarOptlySlotCheckPostcode = pc;
    var url = CONFIG.getAvailabilityApiUrl + '/get-availability?postcode=' + encodeURIComponent(pc);
    var timeoutMs = CONFIG.slotCheckTimeoutMs || 5000;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = null;

    var timeoutPromise = new Promise(function (resolve) {
      timeoutId = window.setTimeout(function () {
        if (controller) controller.abort();
        log('Slot check timeout');
        window.__solarOptlySlotCheckResult = { hasSlots: false, error: 'Timeout (' + timeoutMs + 'ms)', postcode: pc };
        resolve(false);
      }, timeoutMs);
    });

    var fetchOptions = {
      method: 'GET',
    };
    if (controller) fetchOptions.signal = controller.signal;
    if (CONFIG.getAvailabilityApiKey) {
      fetchOptions.headers = { 'Authorization': 'Bearer ' + CONFIG.getAvailabilityApiKey };
    }

    var fetchPromise = fetch(url, fetchOptions)
      .then(function (res) {
        if (!res.ok) {
          window.__solarOptlySlotCheckResult = { status: res.status, hasSlots: false, error: 'HTTP ' + res.status, postcode: pc };
          return { slots: [] };
        }
        return res.json();
      })
      .then(function (data) {
        var availability = data.availability || [];
        var hasSlots;
        if (Array.isArray(data.slots)) {
          hasSlots = data.slots.length > 0;
        } else {
          hasSlots = availability.some(function (day) {
            return (day.slots || []).length > 0;
          });
        }
        var totalSlots = 0;
        availability.forEach(function (day) { totalSlots += (day.slots || []).length; });
        window.__solarOptlySlotCheckResult = {
          hasSlots: hasSlots,
          days: availability.length,
          totalSlots: totalSlots,
          postcode: pc,
          raw: data,
        };
        return hasSlots;
      })
      .catch(function (err) {
        log('Slot check failed', err);
        window.__solarOptlySlotCheckResult = { hasSlots: false, error: String(err), postcode: pc };
        return false;
      })
      .finally(function () {
        if (timeoutId) window.clearTimeout(timeoutId);
      });

    return Promise.race([fetchPromise, timeoutPromise]).catch(function () {
      return false;
    });
  }

  function startEligibleSlotCheck(postcode, eventObj, qualifyContext) {
    var pcNorm = String(postcode || '').replace(/\s/g, '').toUpperCase();
    var outward = extractUkOutwardCode(pcNorm);
    if (!outward) {
      window.__solarOptlySlotCheckInFlight = false;
      window.__solarOptlySlotCheckPostcode = pcNorm;
      window.__solarOptlySlotCheckResult = {
        hasSlots: false,
        error: 'Invalid postcode for area check',
        postcode: pcNorm,
      };
      postAppointmentUpdate('failed', 'postcode_not_serviceable');
      hideFullPageSubmitOverlay();
      revealIframeAfterSwap(eventObj.iFrameId);
      keepTypSolarMarketingHidden();
      log('Eligible but postcode too short for outward extract', postcode);
      return;
    }
    loadAllowedOutwardSet()
      .then(function (map) {
        if (!map[outward]) {
          window.__solarOptlySlotCheckInFlight = false;
          window.__solarOptlySlotCheckPostcode = pcNorm;
          window.__solarOptlySlotCheckResult = {
            hasSlots: false,
            error: 'Postcode outside service area',
            postcode: pcNorm,
            outward: outward,
          };
          postAppointmentUpdate('failed', 'postcode_not_serviceable');
          hideFullPageSubmitOverlay();
          revealIframeAfterSwap(eventObj.iFrameId);
          keepTypSolarMarketingHidden();
          log('Postcode outward not in allowlist', outward);
          return 'denied';
        }
        postAppointmentUpdate('progressing', 'slot_check');
        return checkSlotsAvailable(postcode);
      })
      .then(function (result) {
        if (result === 'denied') return;
        window.__solarOptlySlotCheckInFlight = false;
        var hasSlots = result === true;
        if (hasSlots) {
          postAppointmentUpdate('progressing', 'qualified');
          onQualifiedMatch(qualifyContext, eventObj);
        } else {
          postAppointmentUpdate('failed', 'no_slots');
          hideFullPageSubmitOverlay();
          revealIframeAfterSwap(eventObj.iFrameId);
          keepTypSolarMarketingHidden();
          log('Eligible but no slots available; staying on TYP');
        }
      })
      .catch(function (err) {
        window.__solarOptlySlotCheckInFlight = false;
        var msg = String(err && err.message ? err.message : err);
        var step = /allowed list|invalid JSON/i.test(msg) ? 'postcode_allowlist_error' : 'slot_check_error';
        postAppointmentUpdate('failed', step);
        hideFullPageSubmitOverlay();
        revealIframeAfterSwap(eventObj.iFrameId);
        keepTypSolarMarketingHidden();
        log('Allowed list or slot check failed', err);
      });
  }

  // --- Appointment API tracking ---

  window.__solarOptlyAppointmentLog = window.__solarOptlyAppointmentLog || [];
  window.__solarOptlyAppointmentForm = window.__solarOptlyAppointmentForm || null;
  window.__solarOptlySolarData = window.__solarOptlySolarData || null;
  window.__solarOptlyConfirmedAddress = window.__solarOptlyConfirmedAddress || '';

  function getSubmissionId() {
    var prefill = window.__solarOptlyPrefillAnswers || {};
    return prefill.submissionId || '';
  }

  function normalizePhoneE164(raw) {
    if (!raw) return '';
    var digits = raw.replace(/\D/g, '');
    if (digits.length < 10) return raw;
    if (digits.indexOf('44') === 0 && digits.length >= 12) return '+' + digits;
    if (digits.indexOf('0') === 0 && digits.length === 11) return '+44' + digits.slice(1);
    if (digits.length === 10 || digits.length === 11) {
      return '+44' + (digits.indexOf('0') === 0 ? digits.slice(1) : digits);
    }
    return raw;
  }

  function buildLeadPayload() {
    var prefill = window.__solarOptlyPrefillAnswers || {};
    return {
      first_name: prefill.first_name || '',
      last_name: prefill.last_name || '',
      postcode: window.__solarOptlyConfirmedPostcode || prefill.primary_address_postalcode || '',
      email: prefill.email_address || '',
      phone_number: normalizePhoneE164(prefill.phone_number || ''),
      address: window.__solarOptlyConfirmedAddress || '',
    };
  }

  function postAppointmentUpdate(status, step, errorDetail) {
    var submissionId = getSubmissionId();
    if (!submissionId) {
      log('postAppointmentUpdate skipped: no submissionId');
      return;
    }

    var url = CONFIG.appointmentsApiUrl + '/' + encodeURIComponent(submissionId);
    var body;

    if (status === 'failed') {
      url += '/failed';
      body = {
        reason: step,
        lead: buildLeadPayload(),
      };
    } else {
      body = {
        status: status,
        reason: step,
        lead: buildLeadPayload(),
      };
    }

    if (errorDetail) {
      body.error_detail = errorDetail;
    }

    if (window.__solarOptlyAppointmentForm) {
      body.appointment_form = window.__solarOptlyAppointmentForm;
    }
    if (window.__solarOptlySolarData) {
      body.appointment_form = Object.assign(
        {},
        body.appointment_form || {},
        window.__solarOptlySolarData
      );
    }

    var entry = {
      ts: new Date().toISOString(),
      status: status,
      step: step,
      submissionId: submissionId,
      result: 'pending',
      requestBody: body,
    };
    window.__solarOptlyAppointmentLog.push(entry);

    log('postAppointmentUpdate', status, step, body);

    var shouldGetAfter = status === 'successful';

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.appointmentsApiKey,
      },
      body: JSON.stringify(body),
    }).then(function (res) {
      entry.httpStatus = res.status;
      if (!res.ok) {
        entry.result = 'error';
        entry.error = 'HTTP ' + res.status;
        log('postAppointmentUpdate failed', entry.error);
        return;
      }
      return res.json().then(function (data) {
        entry.result = 'ok';
        entry.response = data;
        log('postAppointmentUpdate ok', data);
        if (shouldGetAfter) {
          getAppointmentStatus();
        }
      });
    }).catch(function (err) {
      entry.result = 'error';
      entry.error = String(err);
      log('postAppointmentUpdate error', err);
    });
  }

  function getAppointmentStatus() {
    var submissionId = getSubmissionId();
    if (!submissionId) return;

    var url = CONFIG.appointmentsApiUrl + '/' + encodeURIComponent(submissionId);
    var entry = {
      ts: new Date().toISOString(),
      status: 'GET',
      step: 'final_check',
      submissionId: submissionId,
      result: 'pending',
      requestBody: { method: 'GET', url: url },
    };
    window.__solarOptlyAppointmentLog.push(entry);

    log('getAppointmentStatus', url);

    fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.appointmentsApiKey,
      },
    }).then(function (res) {
      entry.httpStatus = res.status;
      if (!res.ok) {
        entry.result = 'error';
        entry.error = 'HTTP ' + res.status;
        log('getAppointmentStatus failed', entry.error);
        return;
      }
      return res.json().then(function (data) {
        entry.result = 'ok';
        entry.response = data;
        window.__solarOptlyAppointmentFinal = data;
        log('getAppointmentStatus ok', data);
      });
    }).catch(function (err) {
      entry.result = 'error';
      entry.error = String(err);
      log('getAppointmentStatus error', err);
    });
  }

  function buildAppUrl() {
    var separator = CONFIG.appUrl.indexOf('?') === -1 ? '?' : '&';
    var url = CONFIG.appUrl + separator + 'optly_iframe=1&ts=' + now();
    var search = (window.location && window.location.search) || '';
    var params = new URLSearchParams(search);
    if (params.get('debug') === 'true' || params.get('debug') === '1') {
      url += '&debug=1';
    }
    var pc = window.__solarOptlyPrefillPostcode;
    var fn = window.__solarOptlyPrefillFirstName;
    if (pc) {
      url += '&prefill_postcode=' + encodeURIComponent(pc);
      log('buildAppUrl: including prefill_postcode', pc);
    }
    if (fn) {
      url += '&prefill_first_name=' + encodeURIComponent(fn);
      log('buildAppUrl: including prefill_first_name', fn);
    }
    return url;
  }

  function isAppUrl(url) {
    return normalize(url).indexOf(normalize(CONFIG.appUrl)) === 0;
  }

  function hideIframeDuringSwap(preferredIFrameId) {
    var targetIframe = getTargetIframe(preferredIFrameId);
    if (!targetIframe) return false;

    targetIframe.style.visibility = 'hidden';
    targetIframe.style.opacity = '0';
    targetIframe.style.transition = 'none';
    targetIframe.setAttribute('data-solar-optly-swapping', '1');
    return true;
  }

  function revealIframeAfterSwap(preferredIFrameId) {
    var targetIframe = getTargetIframe(preferredIFrameId);
    if (!targetIframe) return false;

    targetIframe.style.transition = 'opacity 400ms ease';
    targetIframe.style.visibility = 'visible';
    targetIframe.style.opacity = '1';
    targetIframe.removeAttribute('data-solar-optly-swapping');
    hideSwapOverlay(preferredIFrameId);
    hideFullPageSubmitOverlay();
    return true;
  }

  function ensureFullPageOverlay() {
    var id = 'solar-optly-submit-fullpage';
    var el = document.getElementById(id);
    if (el) return el;
    if (!document.body) return null;
    el = document.createElement('div');
    el.id = id;
    el.setAttribute('data-solar-optly-fullpage', '1');
    el.style.cssText =
      'position:fixed;inset:0;background:#fff;z-index:999998;opacity:0;pointer-events:none;transition:none;';
    document.body.appendChild(el);
    return el;
  }

  function showFullPageOverlay() {
    var el = ensureFullPageOverlay();
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
  }

  function hideFullPageOverlay() {
    var el = document.getElementById('solar-optly-submit-fullpage');
    if (!el) return;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
  }

  function ensureSubmitOverlay(preferredIFrameId) {
    var targetIframe = getTargetIframe(preferredIFrameId);
    if (!targetIframe) return null;

    var wrapper = targetIframe.closest('.chameleon-widget-wrapper');
    var parent = wrapper ? (wrapper.parentElement || wrapper) : targetIframe.parentElement;
    if (!parent) return null;

    var overlay = parent.querySelector('[data-solar-optly-submit-overlay="1"]');
    if (overlay) return overlay;

    if (!parent.style.position || parent.style.position === 'static') {
      parent.style.position = 'relative';
    }

    overlay = document.createElement('div');
    overlay.setAttribute('data-solar-optly-submit-overlay', '1');
    overlay.style.cssText =
      'position:absolute;top:0;right:0;bottom:0;left:0;background:#ffffff;' +
      'z-index:10000;display:flex;align-items:center;justify-content:center;' +
      'opacity:0;pointer-events:none;transition:none;';
    var spinner = document.createElement('div');
    spinner.style.cssText =
      'width:48px;height:48px;border:5px solid #DAE7E6;' +
      'border-top-color:#03624C;border-radius:50%;animation:solar-optly-spin 0.8s linear infinite;';
    overlay.appendChild(spinner);

    var style = document.getElementById('solar-optly-spin-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'solar-optly-spin-style';
      style.textContent = '@keyframes solar-optly-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    parent.appendChild(overlay);
    return overlay;
  }

  function showFullPageSubmitOverlay(preferredIFrameId) {
    var el = ensureSubmitOverlay(preferredIFrameId);
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    var targetIframe = getTargetIframe(preferredIFrameId);
    if (targetIframe) {
      // Preserve the iframe's current height so we can restore it for the Chameleon TYP
      if (!window.__solarOptlyPreOverlayHeight) {
        window.__solarOptlyPreOverlayHeight =
          parseInt(targetIframe.style.height, 10) || window.__solarOptlyChameleonHeight || 0;
      }
      targetIframe.style.height = '378px';
      var wrapper = targetIframe.closest('.chameleon-widget-wrapper');
      if (wrapper) {
        wrapper.style.height = '378px';
        var card = wrapper.firstElementChild;
        if (card && card.nodeType === 1) card.style.height = '378px';
      }
    }
  }

  function hideFullPageSubmitOverlay() {
    var overlay = document.querySelector('[data-solar-optly-submit-overlay="1"]');
    if (!overlay) return;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';

    // When the solar form is injected, attachIframeHeightSync manages the
    // iframe height — don't interfere by removing or overwriting it.
    if (window.__solarOptlyIframeInjected) {
      heightLog('hideFullPageSubmitOverlay', { skippedHeightRestore: true, reason: 'solar form manages own height' });
      window.__solarOptlyPreOverlayHeight = 0;
      return;
    }

    // Chameleon TYP: restore to the height Chameleon expects
    var restoreHeight = window.__solarOptlyChameleonHeight || window.__solarOptlyPreOverlayHeight || 0;
    window.__solarOptlyPreOverlayHeight = 0;

    var iframes = document.querySelectorAll('iframe[id^="' + CONFIG.iframeIdPrefix + '"]');
    for (var i = 0; i < iframes.length; i++) {
      if (restoreHeight > 0) {
        iframes[i].style.height = restoreHeight + 'px';
      } else {
        iframes[i].style.removeProperty('height');
      }
      var wrapper = iframes[i].closest('.chameleon-widget-wrapper');
      if (wrapper) {
        if (restoreHeight > 0) {
          wrapper.style.height = restoreHeight + 'px';
        } else {
          wrapper.style.removeProperty('height');
        }
        var card = wrapper.firstElementChild;
        if (card && card.nodeType === 1) {
          if (restoreHeight > 0) {
            card.style.height = restoreHeight + 'px';
          } else {
            card.style.removeProperty('height');
          }
        }
      }
    }
    heightLog('hideFullPageSubmitOverlay', { restoreHeight: restoreHeight });
  }

  function ensureSwapOverlay(preferredIFrameId) {
    var targetIframe = getTargetIframe(preferredIFrameId);
    if (!targetIframe) return null;

    var wrapper = targetIframe.closest('.chameleon-widget-wrapper');
    if (!wrapper) return null;

    var parent = wrapper.parentElement || wrapper;
    if (parent.style.position === '') {
      parent.style.position = 'relative';
    }

    var overlay = parent.querySelector('[data-solar-optly-overlay="1"]');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.setAttribute('data-solar-optly-overlay', '1');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.left = '0';
    overlay.style.background = '#ffffff';
    overlay.style.zIndex = '9999';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.transition = 'opacity 400ms ease';
    parent.appendChild(overlay);
    return overlay;
  }

  function showSwapOverlay(preferredIFrameId) {
    var overlay = ensureSwapOverlay(preferredIFrameId);
    if (!overlay) return false;
    overlay.style.transition = 'none';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    return true;
  }

  function hideSwapOverlay(preferredIFrameId) {
    var targetIframe = getTargetIframe(preferredIFrameId);
    if (!targetIframe) return false;
    var wrapper = targetIframe.closest('.chameleon-widget-wrapper');
    if (!wrapper) return false;
    var parent = wrapper.parentElement || wrapper;
    var overlay = parent.querySelector('[data-solar-optly-overlay="1"]');
    if (!overlay) return false;
    overlay.style.transition = 'opacity 400ms ease';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    return true;
  }

  function attachIframeHeightSync(preferredIFrameId) {
    var targetIframe = getTargetIframe(preferredIFrameId);
    if (!targetIframe) return false;

    var clearWrapperHeightConstraints = function () {
      var activeIframe = getTargetIframe(preferredIFrameId);
      if (!activeIframe) return;
      activeIframe.style.removeProperty('min-height');

      var wrapper = activeIframe.closest('.chameleon-widget-wrapper');
      if (!wrapper) return;
      wrapper.style.removeProperty('height');
      wrapper.style.removeProperty('min-height');

      var wrapperCard = wrapper.firstElementChild;
      if (!wrapperCard || wrapperCard.nodeType !== 1) return;

      wrapperCard.style.removeProperty('height');
      wrapperCard.style.removeProperty('min-height');
      heightLog('cleared wrapper height constraints', {
        iframeId: activeIframe.id,
      });
    };

    var applyIframeHeight = function (nextHeight) {
      var activeIframe = getTargetIframe(preferredIFrameId);
      if (!activeIframe) return;

      var normalizedHeight = Math.max(200, Math.ceil(Number(nextHeight) || 0));
      if (!normalizedHeight) return;
      if (window.__solarOptlyLastIframeHeight === normalizedHeight) return;
      window.__solarOptlyLastIframeHeight = normalizedHeight;

      activeIframe.style.removeProperty('min-height');
      activeIframe.style.height = normalizedHeight + 'px';
      clearWrapperHeightConstraints();

      // Keep iframe visible/centered when height changes (e.g. step transitions)
      try {
        activeIframe.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        activeIframe.scrollIntoView({ block: 'center' });
      }

      heightLog('applied dynamic iframe height', {
        iframeId: activeIframe.id,
        height: normalizedHeight,
        iframeInlineHeight: activeIframe.style.height,
      });
    };

    var requestHeightFromChild = function () {
      var activeIframe = getTargetIframe(preferredIFrameId);
      if (!activeIframe || !activeIframe.contentWindow) return;
      activeIframe.contentWindow.postMessage(
        {
          type: 'solar-optly-height-request',
        },
        '*'
      );
      heightLog('requested height from child', {
        iframeId: activeIframe.id,
      });
    };

    if (!targetIframe.__solarOptlyHeightBaseStylesApplied) {
      targetIframe.style.width = '100%';
      targetIframe.style.maxWidth = '100%';
      targetIframe.style.display = 'block';
      targetIframe.style.border = '0';
      targetIframe.setAttribute('scrolling', 'no');
      targetIframe.__solarOptlyHeightBaseStylesApplied = true;
    }
    clearWrapperHeightConstraints();

    if (!targetIframe.__solarOptlyHeightSyncOnLoadAttached) {
      targetIframe.addEventListener('load', function () {
        clearWrapperHeightConstraints();
        requestHeightFromChild();
      });
      targetIframe.__solarOptlyHeightSyncOnLoadAttached = true;
    }

    if (!window.__solarOptlyHeightMessageHandlerAttached) {
      window.addEventListener('message', function (event) {
        var activeIframe = getTargetIframe(preferredIFrameId);
        if (!activeIframe || event.source !== activeIframe.contentWindow) return;

        var payload = event.data;
        if (!payload) return;

        if (payload.type === 'solar-optly-loader-complete') {
          revealIframeAfterSwap(preferredIFrameId);
          window.__solarOptlyIframeReadyForReveal = true;
          syncMainPageRowVisibility();
          heightLog('received loader-complete; showing main page rows', {
            iframeId: activeIframe.id,
          });
          return;
        }

        if (payload.type === 'solar-optly-decision-made') {
          hideFullPageSubmitOverlay();
          window.__solarOptlyIframeReadyForReveal = true;
          syncMainPageRowVisibility();
          revealIframeAfterSwap(preferredIFrameId);
          log('User decided:', payload.choice || '(unknown)');
          if (payload.choice === 'book_online') {
            postAppointmentUpdate('progressing', 'book_online');
          } else if (payload.choice === 'no_thanks') {
            postAppointmentUpdate('failed', 'declined_booking');
          }
          return;
        }

        if (payload.type === 'solar-optly-keep-alive') {
          postAppointmentUpdate('progressing', 'keep_alive');
          log('User clicked "I\'m still here"');
          return;
        }

        if (payload.type === 'solar-optly-address') {
          window.__solarOptlyConfirmedAddress = payload.address || '';
          if (payload.postcode) {
            window.__solarOptlyConfirmedPostcode = payload.postcode;
          }
          log('Received confirmed address from iframe', payload.address, payload.postcode);
          return;
        }

        if (payload.type === 'solar-optly-solar-data') {
          window.__solarOptlySolarData = payload.solarData || null;
          log('Received solar data from iframe', payload.solarData);
          return;
        }

        if (payload.type === 'solar-optly-eligibility-step') {
          var eligStep = payload.current_step;
          if (eligStep) {
            postAppointmentUpdate('progressing', eligStep);
          }
          log('Eligibility question step', eligStep);
          return;
        }

        if (payload.type === 'solar-optly-eligibility-partial') {
          window.__solarOptlyAppointmentForm = Object.assign(
            {},
            window.__solarOptlyAppointmentForm || {},
            payload.answers || {}
          );
          log('Received partial eligibility answers from iframe', payload.answers);
          return;
        }

        if (payload.type === 'solar-optly-eligibility') {
          window.__solarOptlyAppointmentForm = payload.answers || null;
          log('Received eligibility answers from iframe', payload.answers, 'eligible:', payload.eligible);
          if (payload.eligible) {
            postAppointmentUpdate('progressing', 'eligibility_passed');
          } else {
            postAppointmentUpdate('failed', 'eligibility_disqualified');
          }
          return;
        }

        if (payload.type === 'solar-optly-booking-result') {
          window.__solarOptlyIframeReadyForReveal = false;
          syncMainPageRowVisibility();
          hideWhatsNextSection(true);
          if (payload.success) {
            if (payload.bookingSlot) {
              var form = window.__solarOptlyAppointmentForm || {};
              form.booking_slot = payload.bookingSlot;
              window.__solarOptlyAppointmentForm = form;
            }
            postAppointmentUpdate('successful', 'booking_confirmed');
          } else {
            var reason = payload.error || 'booking_failed';
            var stepMap = {
              'session_expired': 'session_expired',
              'disqualified': 'disqualified',
              'roof_changed_since_imagery': 'roof_changed_since_imagery',
              'solar_no_segments': 'solar_no_segments',
              'solar_no_coverage': 'solar_no_coverage',
              'solar_api_error': 'solar_api_error',
              'solar_coordinates_unavailable': 'solar_coordinates_unavailable',
            };
            postAppointmentUpdate('failed', stepMap[reason] || 'booking_failed', reason);
          }
          log('Booking result from iframe', payload);
          return;
        }

        if (payload.type === 'solar-optly-prefill-request') {
          var prefillAnswers = window.__solarOptlyPrefillAnswers || {};
          if (Object.keys(prefillAnswers).length > 0 && activeIframe.contentWindow) {
            activeIframe.contentWindow.postMessage(
              { type: 'solar-optly-prefill', answers: prefillAnswers },
              '*'
            );
            log('Sent prefill answers to iframe', prefillAnswers);
          }
          return;
        }

        if (payload.type !== 'solar-optly-height') return;
        heightLog('received height payload', {
          iframeId: activeIframe.id,
          payloadHeight: payload.height,
          path: payload.path,
        });

        // Track page navigation from iframe for appointment updates
        var iframePath = payload.path || '';
        if (iframePath && iframePath !== window.__solarOptlyLastIframePath) {
          window.__solarOptlyLastIframePath = iframePath;
          var pageStepMap = {
            '/': 'index',
            '/address': 'address',
            '/solar-assessment': 'solar_assessment',
            '/eligibility-questions': 'eligibility_questions',
            '/slot-selection': 'slot_selection',
            '/confirmation': 'confirmation',
          };
          var step = pageStepMap[iframePath];
          if (step && step !== 'index' && step !== 'confirmation') {
            postAppointmentUpdate('progressing', 'page_' + step);
          }
        }

        applyIframeHeight(payload.height);
        revealIframeAfterSwap(preferredIFrameId);
      });
      window.__solarOptlyHeightMessageHandlerAttached = true;
    }

    requestHeightFromChild();
    window.setTimeout(requestHeightFromChild, 250);
    window.setTimeout(requestHeightFromChild, 900);
    log('Iframe height sync active');
    return true;
  }

  function swapHeaderLogoToProjectSolar() {
    if (window.__solarOptlyLogoSwapped) return;
    var headerImgs = document.querySelectorAll('header img, .vc_row img[src*="eco"], img[src*="Eco-Experts"], img[src*="Brand-Logo"]');
    var swapped = 0;
    for (var i = 0; i < headerImgs.length; i += 1) {
      var img = headerImgs[i];
      if (/eco.?expert/i.test(img.src) || /Brand-Logo/i.test(img.src)) {
        img.setAttribute('data-original-src', img.src);
        img.src = CONFIG.projectSolarLogoUrl;
        img.alt = 'Project Solar';
        swapped += 1;
      }
    }
    if (swapped > 0) {
      window.__solarOptlyLogoSwapped = true;
      log('Swapped ' + swapped + ' header logo(s) to Project Solar');
    } else {
      log('No Eco Experts header logo found to swap');
    }
  }

  function setMainPageRowVisibility(shouldShow) {
    if (shouldShow) {
      var earlyHide = document.getElementById('solar-optly-early-hide');
      if (earlyHide) earlyHide.remove();
    }

    var nodes = document.querySelectorAll(CONFIG.hiddenMainPageRowSelector);
    if (!nodes || nodes.length === 0) {
      log('No target row found to toggle visibility');
      return;
    }

    var targetIndexes = CONFIG.hiddenMainPageRowIndexes || [];
    var affected = 0;

    for (var i = 0; i < targetIndexes.length; i += 1) {
      var index = targetIndexes[i];
      var node = nodes[index];
      if (!node) continue;

      var currentlyHidden = node.hasAttribute('data-solar-optly-hidden');
      var needsChange = shouldShow ? currentlyHidden : !currentlyHidden;
      if (!needsChange) continue;

      if (shouldShow) {
        node.style.removeProperty('display');
        node.removeAttribute('data-solar-optly-hidden');
      } else {
        node.style.setProperty('display', 'none', 'important');
        node.setAttribute('data-solar-optly-hidden', '1');
      }
      affected += 1;
    }

    if (affected > 0) {
      log('Updated main page rows visibility', {
        selector: CONFIG.hiddenMainPageRowSelector,
        targetIndexes: targetIndexes,
        shouldShow: shouldShow,
        matchedCount: nodes.length,
        affectedCount: affected,
      });
    }
  }

  function hideWhatsNextSection(shouldHide) {
    var headings = document.querySelectorAll('h2, h3, h4, .vc_custom_heading');
    for (var i = 0; i < headings.length; i += 1) {
      var text = (headings[i].textContent || '').trim().toLowerCase();
      if (text.indexOf('what happens next') !== -1) {
        var row = headings[i].closest('.vc_row') || headings[i].parentElement;
        while (row && row !== document.body) {
          if (row.classList && row.classList.contains('vc_row')) break;
          row = row.parentElement;
        }
        if (row && row !== document.body) {
          if (shouldHide) {
            row.style.setProperty('display', 'none', 'important');
            row.setAttribute('data-solar-optly-whats-next-hidden', '1');
          } else {
            row.style.removeProperty('display');
            row.removeAttribute('data-solar-optly-whats-next-hidden');
          }
          log('What happens next section ' + (shouldHide ? 'hidden' : 'shown'));
          return;
        }
      }
    }
    log('What happens next section not found in DOM');
  }

  function findVcRowForNode(el) {
    var row = el.closest('.vc_row') || el.parentElement;
    while (row && row !== document.body) {
      if (row.classList && row.classList.contains('vc_row')) break;
      row = row.parentElement;
    }
    return row && row !== document.body ? row : null;
  }

  function normalizeTypText(raw) {
    return String(raw || '')
      .toLowerCase()
      .replace(/\u2019/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Hide TYP rows: Project Solar “matched / consultation” hero and “Why 50,000… Trust” strip. */
  function hideTypProjectSolarPromoSections(shouldHide) {
    var nodes = document.querySelectorAll('h1, h2, h3, h4, .vc_custom_heading, p');
    var seenRows = [];
    var hiddenCount = 0;
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      var tag = (el.tagName || '').toLowerCase();
      var t = normalizeTypText(el.textContent || '');
      if (!t) continue;
      if (tag === 'p' && t.length > 500) continue;

      var matchHero =
        (t.indexOf("you've been matched") !== -1 && t.indexOf('project solar') !== -1) ||
        t.indexOf('personalised consultation') !== -1 ||
        t.indexOf('personalized consultation') !== -1;
      var matchTrust =
        t.indexOf('why') !== -1 &&
        (t.indexOf('50,000') !== -1 || t.indexOf('50000') !== -1) &&
        t.indexOf('trust') !== -1;

      if (!matchHero && !matchTrust) continue;

      var row = findVcRowForNode(el);
      if (!row) continue;
      var already = false;
      for (var s = 0; s < seenRows.length; s += 1) {
        if (seenRows[s] === row) {
          already = true;
          break;
        }
      }
      if (already) continue;
      seenRows.push(row);

      if (shouldHide) {
        row.style.setProperty('display', 'none', 'important');
        row.setAttribute('data-solar-optly-typ-promo-hidden', '1');
        hiddenCount += 1;
      } else {
        row.style.removeProperty('display');
        row.removeAttribute('data-solar-optly-typ-promo-hidden');
      }
    }
    if (shouldHide && hiddenCount > 0) {
      log('TYP Project Solar promo rows hidden', hiddenCount);
    }
  }

  function syncMainPageRowVisibility() {
    setMainPageRowVisibility(!!window.__solarOptlyIframeReadyForReveal);
  }

  function keepTypSolarMarketingHidden() {
    window.__solarOptlyIframeReadyForReveal = false;
    syncMainPageRowVisibility();
    hideTypProjectSolarPromoSections(true);
  }

  function watchMainPageRowVisibility() {
    if (window.__solarOptlyMainPageRowObserver) return;

    try {
      var debounceId = null;
      var observer = new MutationObserver(function () {
        if (hasAnswersInDataLayer()) {
          observer.disconnect();
          window.__solarOptlyMainPageRowObserver = null;
          log('Main page row observer stopped (answers present)');
          return;
        }
        if (debounceId) window.clearTimeout(debounceId);
        debounceId = window.setTimeout(function () {
          debounceId = null;
          syncMainPageRowVisibility();
          if (!window.__solarOptlyIframeReadyForReveal) {
            hideTypProjectSolarPromoSections(true);
          }
        }, 100);
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
      window.__solarOptlyMainPageRowObserver = observer;
      log('Main page row visibility observer attached');
    } catch (e) {
      log('Failed to attach main page row observer', e);
    }
  }

  function lockIframeToApp(preferredIFrameId) {
    if (window.__solarOptlyIframeLockActive) return;

    var targetIframe = getTargetIframe(preferredIFrameId);
    if (!targetIframe) return;

    window.__solarOptlyIframeLockActive = true;
    log('Activating iframe lock', targetIframe.id);

    var enforce = function () {
      if (!window.__solarOptlyQualified) return;
      var current = targetIframe.getAttribute('src') || '';
      if (!isAppUrl(current)) {
        // Reuse first injected URL (stable query) so we do not bump &ts= on every
        // enforce — a new src string forces a full iframe reload and splits analytics
        // (e.g. Microsoft Clarity) into separate sessions per step.
        var forced = window.__solarOptlyPinnedAppSrc || buildAppUrl();
        if (!window.__solarOptlyPinnedAppSrc) {
          window.__solarOptlyPinnedAppSrc = forced;
        }
        targetIframe.src = forced;
        targetIframe.setAttribute('data-solar-optly', 'mounted');
        log('Iframe lock enforced app src', {
          iframeId: targetIframe.id,
          from: current,
          to: forced,
        });
      }
    };

    // React to direct src mutations.
    try {
      var observer = new MutationObserver(function () {
        enforce();
      });
      observer.observe(targetIframe, {
        attributes: true,
        attributeFilter: ['src'],
      });
      window.__solarOptlyIframeObserver = observer;
    } catch (e) {
      log('Unable to observe iframe src mutations', e);
    }

    // Also enforce around load transitions and periodic checks.
    targetIframe.addEventListener('load', enforce);
    var lockInterval = window.setInterval(function () {
      if (!window.__solarOptlyQualified) return;
      enforce();
    }, 500);
    window.__solarOptlyIframeLockInterval = lockInterval;

    enforce();
  }

  function swapIframeSrc(preferredIFrameId) {
    if (window.__solarOptlyIframeInjected) return true;

    var targetIframe = getTargetIframe(preferredIFrameId);
    if (!targetIframe) return false;

    // Ensure iframe sandbox permits same-origin and downloads (for .ics calendar export)
    var sandbox = targetIframe.getAttribute('sandbox') || '';
    if (sandbox) {
      var needed = ['allow-same-origin', 'allow-downloads'];
      var updated = sandbox;
      for (var si = 0; si < needed.length; si += 1) {
        if (updated.indexOf(needed[si]) === -1) {
          updated += ' ' + needed[si];
        }
      }
      if (updated !== sandbox) {
        targetIframe.setAttribute('sandbox', updated);
      }
    }

    var nextSrc = buildAppUrl();
    window.__solarOptlyPinnedAppSrc = nextSrc;

    hideIframeDuringSwap(preferredIFrameId || targetIframe.id);
    targetIframe.src = nextSrc;
    targetIframe.setAttribute('data-solar-optly', 'mounted');
    window.__solarOptlyIframeInjected = true;
    window.__solarOptlyIframeReadyForReveal = false;

    if (!targetIframe.__solarOptlyRevealOnAppLoadAttached) {
      targetIframe.addEventListener('load', function () {
        var current = targetIframe.getAttribute('src') || '';
        if (!isAppUrl(current)) return;
        revealIframeAfterSwap(preferredIFrameId || targetIframe.id);
      });
      targetIframe.__solarOptlyRevealOnAppLoadAttached = true;
    }

    // Fallback reveal guard in case load/messaging events are delayed.
    window.setTimeout(function () {
      revealIframeAfterSwap(preferredIFrameId || targetIframe.id);
    }, 2500);

    attachIframeHeightSync(preferredIFrameId || targetIframe.id);
    syncMainPageRowVisibility();
    log('Injected app into iframe', {
      iframeId: targetIframe.id,
      src: nextSrc,
    });
    lockIframeToApp(preferredIFrameId || targetIframe.id);
    return true;
  }

  function swapIframeWhenReady(preferredIFrameId) {
    var started = Date.now();
    var timer = window.setInterval(function () {
      hideIframeDuringSwap(preferredIFrameId);
      if (swapIframeSrc(preferredIFrameId)) {
        window.clearInterval(timer);
        return;
      }
      if (Date.now() - started > CONFIG.maxWaitMs) {
        window.clearInterval(timer);
        log('Timed out waiting for iframe with id prefix', CONFIG.iframeIdPrefix);
      }
    }, CONFIG.pollMs);
  }

  function buildPrefillAnswers(answers, eventObj) {
    if (!answers || typeof answers !== 'object') return {};
    var postcode = extractPostcodeFromAnswers(answers);
    // Chameleon uses: first_name (full name), email1, phone_work
    var fullName = extractTextFromAnswers(answers, ['first_name', 'full_name', 'name']) ||
      extractByKeyPattern(answers, /first_name|full_name|name/i);
    var lastName = extractTextFromAnswers(answers, ['last_name']) ||
      extractByKeyPattern(answers, /last_name/i);
    var email = extractTextFromAnswers(answers, ['email1', 'email_address', 'email']) ||
      extractByKeyPattern(answers, /email/i);
    var phone = extractTextFromAnswers(answers, ['phone_work', 'phone_number', 'phone', 'mobile']) ||
      extractByKeyPattern(answers, /phone|mobile|tel/i);

    // first_name contains full name ("name surname"); split into first/last
    var firstName = fullName;
    if (fullName && !lastName && fullName.indexOf(' ') !== -1) {
      var parts = fullName.split(/\s+/);
      firstName = parts[0] || fullName;
      lastName = parts.slice(1).join(' ') || '';
    }

    var result = {
      first_name: firstName || '',
      last_name: lastName || '',
      primary_address_postalcode: postcode || '',
      phone_number: phone || '',
      email_address: email || '',
      submissionId: (eventObj && (eventObj.submissionId || eventObj.submission_id)) || '',
    };
    if (CONFIG.debug && (!result.last_name || !result.email_address || !result.phone_number)) {
      log('Prefill missing fields; raw answer keys:', Object.keys(answers || {}));
    }
    return result;
  }

  function onQualifiedMatch(context, eventObj) {
    if (window.__solarOptlyQualified) return;
    var answers = (eventObj && eventObj.answers) || {};
    var postcode = extractPostcodeFromAnswers(answers);
    var firstName = extractTextFromAnswers(answers, ['first_name']);
    if (postcode) {
      window.__solarOptlyPrefillPostcode = postcode;
      log('Captured postcode prefill from answers', postcode);
    }
    window.__solarOptlyPrefillAnswers = buildPrefillAnswers(answers, eventObj);
    log('Stored prefill answers for postMessage', window.__solarOptlyPrefillAnswers);
    // Use the split first name (not the raw full name) for the URL param
    var splitFirstName = window.__solarOptlyPrefillAnswers.first_name || firstName || '';
    if (splitFirstName) {
      window.__solarOptlyPrefillFirstName = splitFirstName;
      log('Captured first_name prefill from answers', splitFirstName);
    }
    window.__solarOptlyQualified = true;
    window.__solarOptlyIframeReadyForReveal = false;
    persistEligibilityMarker();
    swapHeaderLogoToProjectSolar();
    log('Eligibility matched via', context);
    var preferredIFrameId = (eventObj && eventObj.iFrameId) || null;
    if (preferredIFrameId) {
      showSwapOverlay(preferredIFrameId);
      hideIframeDuringSwap(preferredIFrameId);
      log('Qualified before TYP; marker persisted for iframe', preferredIFrameId);
    }
    // Swap even without iFrameId (e.g. webform_submission_completed often lacks it).
    // getTargetIframe(null) falls back to first iframe with prefix.
    swapIframeWhenReady(preferredIFrameId);
    lockIframeToApp(preferredIFrameId);
  }

  var __submitFlowEventIndex = 0;

  function processDataLayerEvent(eventObj) {
    if (!eventObj || typeof eventObj !== 'object') return;

    var eventName = eventObj.event || '(no event name)';
    var isSubmitFlow = [
      'pageChanged',
      'thankYouPageRequested',
      'formSubmit',
      'resultsPageURL',
      'webform_submission_completed',
      'thankYouPageReached',
    ].indexOf(eventName) !== -1;

    if (isSubmitFlow) {
      __submitFlowEventIndex += 1;
      log(
        'Submit Flow #' + __submitFlowEventIndex,
        eventName,
        {
          currentQuestion: eventObj.currentQuestion,
          iFrameId: eventObj.iFrameId,
          submissionId: eventObj.submissionId,
          armed: window.__solarOptlySubmitStageArmed,
        }
      );
    }

    log('dataLayer event seen', eventName, eventObj);

    if (eventObj.event === 'thankYouPageReached' || eventObj.event === 'webform_submission_completed') {
      syncMainPageRowVisibility();
    }

    if (eventObj.event === 'pageChanged') {
      var question = normalize(eventObj.currentQuestion || '');
      window.__solarOptlySubmitStageArmed = question === 'phone number';
      if (question === 'phone number' && eventObj.iFrameId) {
        ensureSubmitOverlay(eventObj.iFrameId);
      }
    }

    if (
      (eventObj.event === 'thankYouPageRequested' || eventObj.event === 'formSubmit') &&
      window.__solarOptlySubmitStageArmed
    ) {
      showSubmitOverlays(eventObj.iFrameId, 'dataLayer');
    }

    if (eventObj.event === 'webform_submission_completed') {
      var answers = eventObj.answers || {};
      log('Processing webform_submission_completed', {
        answerKeys: Object.keys(answers),
        postcode: extractPostcodeFromAnswers(answers),
        firstName: extractTextFromAnswers(answers, ['first_name']),
      });

      // Build prefill answers early so submissionId + lead data are
      // available for appointment API calls during the slot check.
      if (!window.__solarOptlyPrefillAnswers || !window.__solarOptlyPrefillAnswers.submissionId) {
        window.__solarOptlyPrefillAnswers = buildPrefillAnswers(answers, eventObj);
        log('Early prefill answers built for appointment tracking', window.__solarOptlyPrefillAnswers);
      }

      if (isEligible(eventObj.answers || {})) {
        var postcode = extractPostcodeFromAnswers(eventObj.answers || {});
        if (!postcode) {
          log('Eligible but no postcode; cannot check slots; staying on TYP');
          hideFullPageSubmitOverlay();
          revealIframeAfterSwap(eventObj.iFrameId);
          keepTypSolarMarketingHidden();
          return;
        }
        if (window.__solarOptlySlotCheckInFlight) {
          log('Slot check already in flight; skipping duplicate');
          return;
        }
        window.__solarOptlySlotCheckInFlight = true;
        startEligibleSlotCheck(postcode, eventObj, 'webform_submission_completed');
      } else {
        postAppointmentUpdate('failed', 'not_eligible');
        hideFullPageSubmitOverlay();
        revealIframeAfterSwap(eventObj.iFrameId);
        keepTypSolarMarketingHidden();
        log('Submission did not match eligibility');
      }
      return;
    }

    // Some stacks may expose answers on thankYouPageReached payloads.
    if (eventObj.event === 'thankYouPageReached') {
      var typrAnswers = eventObj.answers || {};
      log('Processing thankYouPageReached', {
        answerKeys: Object.keys(typrAnswers),
        postcode: extractPostcodeFromAnswers(typrAnswers),
        firstName: extractTextFromAnswers(typrAnswers, ['first_name']),
      });

      if (!window.__solarOptlyPrefillAnswers || !window.__solarOptlyPrefillAnswers.submissionId) {
        var built = buildPrefillAnswers(typrAnswers, eventObj);
        if (built.submissionId) {
          window.__solarOptlyPrefillAnswers = built;
          log('Early prefill answers built from thankYouPageReached', built);
        }
      }

      if (isEligible(eventObj.answers || {})) {
        var postcode = extractPostcodeFromAnswers(eventObj.answers || {});
        if (!postcode) {
          log('Eligible but no postcode; cannot check slots; staying on TYP');
          hideFullPageSubmitOverlay();
          revealIframeAfterSwap(eventObj.iFrameId);
          keepTypSolarMarketingHidden();
          return;
        }
        if (window.__solarOptlySlotCheckInFlight) {
          log('Slot check already in flight; skipping duplicate from thankYouPageReached');
          return;
        }
        window.__solarOptlySlotCheckInFlight = true;
        startEligibleSlotCheck(postcode, eventObj, 'thankYouPageReached');
      } else if (window.__solarOptlyQualified || window.__solarOptlySlotCheckInFlight) {
        if (window.__solarOptlySlotCheckInFlight) {
          log('Slot check in flight; keeping overlay until it resolves');
          return;
        }
        var answers = eventObj.answers || {};
        var pc = extractPostcodeFromAnswers(answers);
        var fn = extractTextFromAnswers(answers, ['first_name']);
        if (pc && !window.__solarOptlyPrefillPostcode) {
          window.__solarOptlyPrefillPostcode = pc;
          log('Captured postcode prefill from thankYouPageReached (already qualified)', pc);
        }
        if (fn && !window.__solarOptlyPrefillFirstName) {
          window.__solarOptlyPrefillFirstName = fn;
          log('Captured first_name prefill from thankYouPageReached (already qualified)', fn);
        }
        log('Already qualified; injecting solar form on thankYouPageReached');
        swapIframeWhenReady(eventObj.iFrameId);
        lockIframeToApp(eventObj.iFrameId);
      } else {
        hideFullPageSubmitOverlay();
        revealIframeAfterSwap(eventObj.iFrameId);
        keepTypSolarMarketingHidden();
        log('thankYouPageReached had no eligible answers and no prior qualification');
      }
    }
  }

  var __processedEventIndexes = {};

  function replayDataLayerEvents() {
    window.dataLayer = window.dataLayer || [];
    for (var i = 0; i < window.dataLayer.length; i += 1) {
      if (__processedEventIndexes[i]) continue;
      __processedEventIndexes[i] = true;
      processDataLayerEvent(window.dataLayer[i]);
    }
  }

  function showSubmitOverlays(iFrameId, source) {
    log('Submit Flow: OVERLAY TRIGGERED (' + source + ')');
    hideIframeDuringSwap(iFrameId);
    showFullPageSubmitOverlay(iFrameId);
    showSwapOverlay(iFrameId);
  }

  function attachPostMessageInterceptor() {
    if (window.__solarOptlyPostMessageHooked) return;
    window.__solarOptlyPostMessageHooked = true;
    window.addEventListener('message', function (event) {
      var data = event.data;
      if (typeof data !== 'string') return;

      // Track Chameleon's native resizeWidget height so we can restore it later
      if (data.indexOf('resizeWidget:') === 0) {
        try {
          var resizePayload = JSON.parse(data.split(/:(.+)/)[1]);
          if (resizePayload && resizePayload.requiredWidgetHeight) {
            window.__solarOptlyChameleonHeight = parseInt(resizePayload.requiredWidgetHeight, 10) || 0;
            heightLog('captured Chameleon resizeWidget height', window.__solarOptlyChameleonHeight);
          }
        } catch (e) { /* ignore */ }
      }

      if (!window.__solarOptlySubmitStageArmed) return;
      var isSubmit =
        data.indexOf('thankYouPageRequested:') === 0 ||
        data.indexOf('formSubmit:') === 0;
      if (!isSubmit) return;
      var iFrameId = null;
      try {
        var payload = JSON.parse(data.split(/:(.+)/)[1]);
        iFrameId = payload && payload.iFrameId;
      } catch (e) { /* ignore */ }
      showSubmitOverlays(iFrameId, 'postMessage');
    });
    log('postMessage interceptor attached');
  }

  function wrapPush() {
    window.dataLayer = window.dataLayer || [];

    var originalPush = window.dataLayer.push;

    // Skip wrapping if our wrapper is already the current push
    if (originalPush && originalPush.__solarOptlyWrapped) return;

    var wrappedPush = function () {
      var args = Array.prototype.slice.call(arguments);
      for (var j = 0; j < args.length; j += 1) {
        processDataLayerEvent(args[j]);
      }
      return originalPush.apply(window.dataLayer, args);
    };
    wrappedPush.__solarOptlyWrapped = true;
    window.dataLayer.push = wrappedPush;

    log('dataLayer.push wrapped (original was', typeof originalPush, ')');
  }

  function attachDataLayerHook() {
    window.dataLayer = window.dataLayer || [];

    replayDataLayerEvents();
    wrapPush();

    // Safari/GTM resilience: periodically re-scan and re-hook in case
    // GTM replaces our push override or events were pushed before our hook.
    if (!window.__solarOptlyDataLayerPolling) {
      window.__solarOptlyDataLayerPolling = true;
      var pollCount = 0;
      var pollInterval = window.setInterval(function () {
        pollCount += 1;
        // Re-wrap push if something overwrote it
        if (
          !window.dataLayer.push ||
          !window.dataLayer.push.__solarOptlyWrapped
        ) {
          log('dataLayer.push was overwritten; re-wrapping (poll #' + pollCount + ')');
          wrapPush();
        }
        // Re-scan for events we haven't seen yet
        replayDataLayerEvents();
        // Stop polling after qualification or after 2 minutes
        if (window.__solarOptlyQualified || pollCount >= 240) {
          window.clearInterval(pollInterval);
          log('dataLayer polling stopped', {
            qualified: !!window.__solarOptlyQualified,
            pollCount: pollCount,
          });
        }
      }, 500);
    }

    log('dataLayer hook attached');

    if (CONFIG.debug) {
      ensureDebugPopup();
      updateDebugPopup();
      if (!window.__solarOptlyDebugRefresh) {
        window.__solarOptlyDebugRefresh = true;
        window.setInterval(updateDebugPopup, 1000);
      }
    }
  }

  // If the script initializes on TYP after full-page reload, inject for eligible users only.
  var freshMarker = isTypUrl() ? consumeEligibilityMarkerIfFresh() : null;
  if (isTypUrl() && freshMarker) {
    if (freshMarker.prefillPostcode) {
      window.__solarOptlyPrefillPostcode = freshMarker.prefillPostcode;
      log('Loaded postcode prefill from marker', freshMarker.prefillPostcode);
    }
    if (freshMarker.prefillFirstName) {
      window.__solarOptlyPrefillFirstName = freshMarker.prefillFirstName;
      log('Loaded first_name prefill from marker', freshMarker.prefillFirstName);
    }
    if (freshMarker.prefillAnswers && Object.keys(freshMarker.prefillAnswers).length > 0) {
      window.__solarOptlyPrefillAnswers = freshMarker.prefillAnswers;
      log('Loaded prefill answers from marker', freshMarker.prefillAnswers);
    }
    window.__solarOptlyQualified = true;
    window.__solarOptlyIframeReadyForReveal = false;
    hideIframeDuringSwap();
    syncMainPageRowVisibility();
    hideTypProjectSolarPromoSections(true);
    watchMainPageRowVisibility();
    log('Eligible marker found on TYP, attempting iframe injection');
    swapIframeWhenReady();
    lockIframeToApp();
  } else if (isTypUrl()) {
    window.__solarOptlyIframeReadyForReveal = false;
    syncMainPageRowVisibility();
    hideTypProjectSolarPromoSections(true);
    watchMainPageRowVisibility();
    log('On TYP but no fresh eligibility marker; keeping marketing rows hidden until Chameleon completes');
  } else {
    watchMainPageRowVisibility();
  }

  attachPostMessageInterceptor();
  attachDataLayerHook();
})();
