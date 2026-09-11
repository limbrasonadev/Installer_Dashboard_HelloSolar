/**
 * ==========================================================================
 * HELLO SOLAR INSTALLER PORTAL — DATA ENGINE & VALIDATION MODULE
 * Single authoritative source: assets/data/installer.json
 * No duplicate datasets in JavaScript.
 * Strict schema validation, local override persistence, and formatting helpers.
 * ==========================================================================
 */

const InstallerData = (() => {
    'use strict';

    const STORAGE_KEY_OVERRIDE = 'hello_solar_installer_json_override';
    const STORAGE_KEY_CACHE = 'hello_solar_installer_json_cache';

    let cachedData = null;

    /**
     * Validates an installer dataset object according to schema rules.
     * Returns an object { valid: boolean, errors: string[] }.
     */
    function validateDataset(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Dataset must be a valid JSON object.'] };
        }

        // Validate jobs
        if (!Array.isArray(data.jobs) || data.jobs.length === 0) {
            errors.push('Dataset must contain a non-empty "jobs" array.');
        } else {
            const jobIds = new Set();
            const allowedJobStatuses = ['Scheduled', 'In progress', 'Completed'];

            data.jobs.forEach((job, index) => {
                const prefix = `Job #${index + 1} (${job.id || 'unidentified'})`;
                if (!job.id || typeof job.id !== 'string') {
                    errors.push(`${prefix}: Missing or invalid "id".`);
                } else if (jobIds.has(job.id)) {
                    errors.push(`${prefix}: Duplicate job ID "${job.id}".`);
                } else {
                    jobIds.add(job.id);
                }

                const customer = job.customer || job.name;
                if (!customer || typeof customer !== 'string') {
                    errors.push(`${prefix}: Missing customer name.`);
                }

                if (!job.system || typeof job.system !== 'string') {
                    errors.push(`${prefix}: Missing solar system description.`);
                }

                if (!job.status || !allowedJobStatuses.includes(job.status)) {
                    errors.push(`${prefix}: Invalid status "${job.status}". Must be one of: ${allowedJobStatuses.join(', ')}.`);
                }

                if (!job.date || typeof job.date !== 'string') {
                    errors.push(`${prefix}: Missing schedule/date.`);
                }

                if (typeof job.progress !== 'number' || job.progress < 0 || job.progress > 100) {
                    errors.push(`${prefix}: Progress must be a number between 0 and 100.`);
                }
            });

            // Validate payouts
            if (Array.isArray(data.payouts)) {
                const payoutIds = new Set();
                const allowedPayoutStatuses = ['Paid', 'Pending review', 'Scheduled'];

                data.payouts.forEach((payout, index) => {
                    const prefix = `Payout #${index + 1} (${payout.id || 'unidentified'})`;
                    if (!payout.id || typeof payout.id !== 'string') {
                        errors.push(`${prefix}: Missing or invalid "id".`);
                    } else if (payoutIds.has(payout.id)) {
                        errors.push(`${prefix}: Duplicate payout ID "${payout.id}".`);
                    } else {
                        payoutIds.add(payout.id);
                    }

                    const linkedJobId = payout.job || payout.jobId;
                    if (!linkedJobId || !jobIds.has(linkedJobId)) {
                        errors.push(`${prefix}: Linked job reference "${linkedJobId}" does not exist in jobs list.`);
                    }

                    const amount = typeof payout.amount === 'number' ? payout.amount : payout.netAmount;
                    if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
                        errors.push(`${prefix}: Amount must be a non-negative number.`);
                    }

                    if (!payout.status || !allowedPayoutStatuses.includes(payout.status)) {
                        errors.push(`${prefix}: Invalid status "${payout.status}". Must be one of: ${allowedPayoutStatuses.join(', ')}.`);
                    }

                    if (!payout.date || typeof payout.date !== 'string') {
                        errors.push(`${prefix}: Missing release date.`);
                    }
                });
            }
        }

        // Validate checklist
        if (data.checklist && !Array.isArray(data.checklist)) {
            errors.push('Checklist must be an array of strings.');
        }

        // Validate faqs
        if (data.faqs && !Array.isArray(data.faqs)) {
            errors.push('FAQs must be an array of category items.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Normalizes job and payout properties for seamless backward-compatibility
     */
    function normalizeData(raw) {
        const data = JSON.parse(JSON.stringify(raw));

        if (Array.isArray(data.jobs)) {
            data.jobs = data.jobs.map(job => {
                const customer = job.customer || job.name || 'Unnamed Client';
                const site = job.site || 'Metro Manila';
                const region = job.region || (site.includes(',') ? site.split(',').pop().trim() : 'Metro Manila');
                const step = job.step || 'Proceed with approved installation guidelines';
                const capacityKwp = job.capacityKwp || parseFloat(job.system) || 5.0;

                return {
                    ...job,
                    customer,
                    site,
                    region,
                    step,
                    capacityKwp
                };
            });
        }

        if (Array.isArray(data.payouts)) {
            data.payouts = data.payouts.map(p => {
                const jobId = p.job || p.jobId;
                const netAmount = typeof p.amount === 'number' ? p.amount : (p.netAmount || 0);
                const grossAmount = typeof p.grossAmount === 'number' ? p.grossAmount : Math.round(netAmount / 0.98);
                const cwtPercent = p.cwtPercent || 2;
                const cwtDeduction = p.cwtDeduction || (grossAmount - netAmount);

                return {
                    ...p,
                    jobId,
                    amount: netAmount,
                    netAmount,
                    grossAmount,
                    cwtPercent,
                    cwtDeduction
                };
            });
        }

        return data;
    }

    /**
     * Loads the installer dataset:
     * 1. Checks for local override in localStorage
     * 2. Tries to fetch assets/data/installer.json (if on HTTP/HTTPS or compatible protocol)
     * 3. Falls back to cached data in localStorage if fetch fails (e.g. on direct file:///)
     */
    async function loadData() {
        if (cachedData) return cachedData;

        // 1. Check for manual override in localStorage
        try {
            const overrideRaw = localStorage.getItem(STORAGE_KEY_OVERRIDE);
            if (overrideRaw) {
                const parsed = JSON.parse(overrideRaw);
                const validation = validateDataset(parsed);
                if (validation.valid) {
                    cachedData = normalizeData(parsed);
                    return cachedData;
                }
            }
        } catch (e) {
            console.warn('Could not read override storage:', e);
        }

        // 2. Fetch assets/data/installer.json
        if (location.protocol !== 'file:') {
            try {
                const res = await fetch('assets/data/installer.json', { cache: 'no-cache' });
                if (res.ok) {
                    const fetched = await res.json();
                    const validation = validateDataset(fetched);
                    if (validation.valid) {
                        cachedData = normalizeData(fetched);
                        try {
                            localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(fetched));
                        } catch (err) {}
                        return cachedData;
                    } else {
                        console.error('installer.json failed validation:', validation.errors);
                    }
                }
            } catch (err) {
                console.warn('Fetch installer.json failed, falling back to cached storage:', err);
            }
        }

        // 3. Check for previous cache in localStorage
        try {
            const cachedRaw = localStorage.getItem(STORAGE_KEY_CACHE);
            if (cachedRaw) {
                const parsed = JSON.parse(cachedRaw);
                const validation = validateDataset(parsed);
                if (validation.valid) {
                    cachedData = normalizeData(parsed);
                    return cachedData;
                }
            }
        } catch (e) {}

        // 4. Default minimal bootstrap fallback if completely offline with empty cache
        const minimalBootstrap = {
            profile: {
                businessName: "SolarTech Manila Installers",
                fullName: "Engr. Alex Rivera",
                email: "installer@hellosolar.ph",
                phone: "+63 917 555 0199",
                licenseNo: "PCAB Solar Contractor Lic. #2024-8841",
                prcNo: "PRC Reg. Electrical Engineer #0078421",
                coverageArea: "Metro Manila, Cavite, Laguna, Rizal, Batangas",
                specialization: "Rooftop Grid-Tie Systems, Hybrid Storage, Net-Metering Commissioning",
                tier: "Hello Solar Tier 1 Certified",
                partnerRating: 4.95,
                completedJobs: 48,
                totalCapacityKwp: 288,
                safetyRecord: "100% Zero-Incident",
                payoutMethod: "BDO Unibank · Acct ending in 8841 (On File)",
                verificationStatus: "Accreditation on file · Pending seasonal re-audit"
            },
            jobs: [
                {
                    id: "JOB-2026-081",
                    customer: "Bautista Residence",
                    system: "5.4 kW Hybrid",
                    capacityKwp: 5.4,
                    type: "Hybrid PV + Battery Storage",
                    site: "Batasan Hills, Quezon City",
                    region: "Metro Manila",
                    status: "Scheduled",
                    date: "September 18, 2026 · 8:30 AM",
                    step: "Confirm site access and Meralco service entrance rating",
                    progress: 20,
                    stage: "Pre-Installation & Site Access",
                    coordinator: "Engr. Mark Villanueva (+63 917 800 1234)",
                    technicalSpecs: {
                        panels: "10x Trina Solar 540W Vertex S+ Dual-Glass",
                        inverter: "1x Deye 5kW Hybrid Single-Phase (SUN-5K-SG04LP1)",
                        battery: "1x 5.12 kWh Dyness Wall-Mounted LiFePO4",
                        mounting: "Kliplok Standing Seam Aluminum Clamps",
                        sldPermit: "PEE-Stamped SLD Approved by QC Engineering Office",
                        siteAccess: "Gate pass confirmed with village guardhouse. Use secondary contractor driveway."
                    },
                    checklist: [
                        "Appointment and site access confirmed with coordinator",
                        "Approved PEE-stamped SLD & permits verified",
                        "Full-body fall arrest harness and safety PPE inspected",
                        "DC string Voc and insulation resistance verified",
                        "Handover documentation and client briefing prepared"
                    ],
                    siteNotes: "Homeowner requested conduit routing through rear attic to maintain clean front facade."
                }
            ],
            payouts: [
                {
                    id: "PAY-2026-105",
                    job: "JOB-2026-081",
                    customer: "Bautista Residence",
                    milestone: "Initial Mobilization & Equipment Staging (30%)",
                    amount: 13720,
                    grossAmount: 14000,
                    cwtPercent: 2,
                    cwtDeduction: 280,
                    status: "Scheduled",
                    date: "Scheduled for Sept 25, 2026",
                    bank: "BDO Unibank · Acct ending in 8841",
                    refCode: "SCHED-PAY-081",
                    note: "Triggered upon confirmed physical site access and equipment staging verification."
                }
            ],
            checklist: [
                "Appointment and site access confirmed with coordinator",
                "Approved PEE-stamped SLD & permits verified",
                "Full-body fall arrest harness and safety PPE inspected",
                "DC string Voc and insulation resistance verified",
                "Handover documentation and client briefing prepared"
            ],
            faqs: []
        };

        cachedData = normalizeData(minimalBootstrap);
        return cachedData;
    }

    /**
     * Saves user-imported JSON override into localStorage and reloads cache
     */
    function saveOverride(jsonData) {
        const validation = validateDataset(jsonData);
        if (!validation.valid) {
            return validation;
        }

        try {
            localStorage.setItem(STORAGE_KEY_OVERRIDE, JSON.stringify(jsonData));
            cachedData = normalizeData(jsonData);
            return { valid: true };
        } catch (e) {
            return { valid: false, errors: ['Local storage quota exceeded or storage disabled.'] };
        }
    }

    /**
     * Clears local override and reloads from default assets/data/installer.json
     */
    function resetOverride() {
        try {
            localStorage.removeItem(STORAGE_KEY_OVERRIDE);
        } catch (e) {}
        cachedData = null;
    }

    /**
     * Formatter for Philippine Peso (₱)
     */
    function formatMoney(amount) {
        const val = Number(amount) || 0;
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            maximumFractionDigits: 0
        }).format(val);
    }

    /**
     * Escape special HTML characters to prevent XSS
     */
    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }

    /**
     * Render semantic status badge
     */
    function renderStatusBadge(status) {
        const s = String(status || '').trim();
        let badgeClass = 'badge-pending';
        let icon = '●';

        if (s === 'Completed' || s === 'Paid') {
            badgeClass = 'badge-success';
        } else if (s === 'In progress') {
            badgeClass = 'badge-progress';
        } else if (s === 'Scheduled') {
            badgeClass = 'badge-info';
        } else if (s === 'Pending review') {
            badgeClass = 'badge-warning';
        }

        return `<span class="status-badge ${badgeClass}"><span class="badge-dot">${icon}</span> ${escapeHtml(s)}</span>`;
    }

    /**
     * Download text / CSV file
     */
    function downloadFile(filename, content, type = 'text/csv;charset=utf-8;') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return {
        loadData,
        validateDataset,
        saveOverride,
        resetOverride,
        formatMoney,
        escapeHtml,
        renderStatusBadge,
        downloadFile
    };
})();

if (typeof window !== 'undefined') {
    window.InstallerData = InstallerData;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InstallerData;
}

