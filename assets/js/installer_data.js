/**
 * ==========================================================================
 * HELLO SOLAR INSTALLER PORTAL — DATA ENGINE & REACTIVE STATE MANAGER
 * Single centralized source of truth for Installer job data.
 * Reactive subscribers, state mutations (acceptJob, declineJob),
 * standardized status badge rendering, and schema validation.
 * ==========================================================================
 */

const InstallerData = (() => {
    'use strict';

    const STORAGE_KEY_JOBS_STATE = 'hello_solar_installer_jobs_state_v2';
    const STORAGE_KEY_OVERRIDE = 'hello_solar_installer_json_override';
    const STORAGE_KEY_CACHE = 'hello_solar_installer_json_cache';

    let cachedData = null;
    const subscribers = new Set();

    /**
     * Canonicalizes job status to ensure system-wide consistency:
     * - Maintenance (Red)
     * - In Progress (Orange)
     * - Completed (Green)
     * - New Job (Subtle Blue)
     */
    function canonicalizeStatus(status) {
        const s = String(status || '').trim().toLowerCase();
        if (s === 'maintenance' || s === 'needs attention' || s === 'action needed' || s === 'delayed' || s === 'issue' || s === 'on hold' || s === 'repair') {
            return 'Maintenance';
        }
        if (s === 'in progress' || s === 'in_progress') {
            return 'In Progress';
        }
        if (s === 'completed' || s === 'commissioned' || s === 'done') {
            return 'Completed';
        }
        if (s === 'new job' || s === 'new' || s === 'pending' || s === 'scheduled' || s === 'assigned' || s === 'pending confirmation') {
            return 'New Job';
        }
        if (s === 'declined') {
            return 'Declined';
        }
        return 'In Progress';
    }

    /**
     * Validates an installer dataset object according to schema rules.
     */
    function validateDataset(data) {
        const errors = [];
        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Dataset must be a valid JSON object.'] };
        }

        if (!Array.isArray(data.jobs) || data.jobs.length === 0) {
            errors.push('Dataset must contain a non-empty "jobs" array.');
        } else {
            const jobIds = new Set();
            data.jobs.forEach((job, index) => {
                const prefix = `Job #${index + 1} (${job.id || 'unidentified'})`;
                const id = job.id || job.applicantId;
                if (!id || typeof id !== 'string') {
                    errors.push(`${prefix}: Missing or invalid "id" or "applicantId".`);
                } else if (jobIds.has(id)) {
                    errors.push(`${prefix}: Duplicate job ID "${id}".`);
                } else {
                    jobIds.add(id);
                }

                if (!job.system || typeof job.system !== 'string') {
                    errors.push(`${prefix}: Missing solar system description.`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Normalizes job and payout properties
     */
    function normalizeData(raw) {
        const data = JSON.parse(JSON.stringify(raw));

        if (Array.isArray(data.jobs)) {
            data.jobs = data.jobs.map(job => {
                const applicantId = job.applicantId || job.id || 'APP-1000';
                const id = job.id || applicantId;
                const customer = job.customer || job.name || 'Client';
                const site = job.site || job.location || 'Metro Manila';
                const location = job.location || (site.includes(',') ? site.split(',').pop().trim() : site);
                const region = job.region || location;
                const status = canonicalizeStatus(job.status);
                const step = job.step || 'Proceed with approved installation guidelines';
                const capacityKwp = job.capacityKwp || parseFloat(job.system) || 5.0;
                const progress = typeof job.progress === 'number' ? job.progress : (status === 'Completed' ? 100 : (status === 'New Job' ? 0 : 50));

                return {
                    ...job,
                    id,
                    applicantId,
                    customer,
                    site,
                    location,
                    region,
                    status,
                    step,
                    capacityKwp,
                    progress
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
     * Synchronizes and persists active jobs state
     */
    function persistJobsState(jobs) {
        try {
            localStorage.setItem(STORAGE_KEY_JOBS_STATE, JSON.stringify(jobs));
        } catch (e) {
            console.warn('Could not save jobs state to localStorage:', e);
        }
    }

    /**
     * Loads persisted jobs state if available
     */
    function loadPersistedJobsState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_JOBS_STATE);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Could not read jobs state from localStorage:', e);
        }
        return null;
    }

    /**
     * Notify all reactive subscribers
     */
    function notifySubscribers(event) {
        subscribers.forEach(fn => {
            try {
                fn(event);
            } catch (err) {
                console.error('Subscriber error:', err);
            }
        });
    }

    /**
     * Subscribe to data mutations
     */
    function subscribe(fn) {
        if (typeof fn === 'function') {
            subscribers.add(fn);
            return () => subscribers.delete(fn);
        }
        return () => {};
    }

    /**
     * Loads the installer dataset
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
                    // Check if state overrides jobs
                    const savedJobs = loadPersistedJobsState();
                    if (savedJobs) cachedData.jobs = savedJobs;
                    return cachedData;
                }
            }
        } catch (e) {}

        // 2. Fetch assets/data/installer.json
        if (location.protocol !== 'file:') {
            try {
                const res = await fetch('assets/data/installer.json', { cache: 'no-cache' });
                if (res.ok) {
                    const fetched = await res.json();
                    const validation = validateDataset(fetched);
                    if (validation.valid) {
                        cachedData = normalizeData(fetched);
                        const savedJobs = loadPersistedJobsState();
                        if (savedJobs) {
                            cachedData.jobs = savedJobs;
                        } else {
                            persistJobsState(cachedData.jobs);
                        }
                        try {
                            localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(fetched));
                        } catch (err) {}
                        return cachedData;
                    }
                }
            } catch (err) {
                console.warn('Fetch installer.json failed, falling back:', err);
            }
        }

        // 3. Fallback to cache in localStorage
        try {
            const cachedRaw = localStorage.getItem(STORAGE_KEY_CACHE);
            if (cachedRaw) {
                const parsed = JSON.parse(cachedRaw);
                cachedData = normalizeData(parsed);
                const savedJobs = loadPersistedJobsState();
                if (savedJobs) cachedData.jobs = savedJobs;
                return cachedData;
            }
        } catch (e) {}

        // 4. Default in-memory bootstrap fallback
        const fallbackBootstrap = {
            profile: {
                businessName: "SolarTech Manila Installers",
                fullName: "Engr. Alex Rivera",
                email: "installer@hellosolar.ph",
                phone: "+63 917 555 0199",
                licenseNo: "PCAB Solar Contractor Lic. #2024-8841",
                prcNo: "PRC Reg. Electrical Engineer #0078421",
                coverageArea: "Metro Manila, Cavite, Laguna, Rizal, Batangas, Cebu",
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
                    id: "APP-1024",
                    applicantId: "APP-1024",
                    customer: "Caballero Residence",
                    system: "5.4 kW Hybrid",
                    capacityKwp: 5.4,
                    type: "Hybrid PV + Battery Storage",
                    location: "Cebu City",
                    site: "Banilad, Cebu City",
                    region: "Cebu",
                    status: "New Job",
                    date: "Today · 10:00 AM",
                    step: "Awaiting installer confirmation & site acceptance",
                    progress: 0,
                    stage: "Pending Installer Confirmation",
                    coordinator: "Engr. Mark Villanueva (+63 917 800 1234)",
                    technicalSpecs: {
                        panels: "10x Trina Solar 540W Vertex S+ Dual-Glass",
                        inverter: "1x Deye 5kW Hybrid Single-Phase (SUN-5K-SG04LP1)",
                        battery: "1x 5.12 kWh Dyness Wall-Mounted LiFePO4",
                        mounting: "Kliplok Standing Seam Aluminum Clamps",
                        sldPermit: "PEE-Stamped SLD Approved by Cebu City Engineering Office",
                        siteAccess: "Subdivision security pass required at main guardhouse."
                    },
                    checklist: [
                        "Confirm job assignment and safety dispatch",
                        "Homeowner appointment verification",
                        "Main electrical breaker rating check",
                        "Rooftop rafter inspection",
                        "Safety fall arrest gear preparation"
                    ],
                    siteNotes: "Customer requested inverter installation in garage area beside main electrical panel."
                },
                {
                    id: "APP-1027",
                    applicantId: "APP-1027",
                    customer: "Tan Commercial Warehouse",
                    system: "8.2 kW Grid-Tied",
                    capacityKwp: 8.2,
                    type: "Grid-Tied Commercial Rooftop",
                    location: "Mandaue City",
                    site: "Subangdaku, Mandaue City",
                    region: "Cebu",
                    status: "New Job",
                    date: "Tomorrow · 8:30 AM",
                    step: "Confirm job assignment and review staging plan",
                    progress: 0,
                    stage: "Pending Installer Confirmation",
                    coordinator: "Ms. Clarisse Santos (+63 917 800 5678)",
                    technicalSpecs: {
                        panels: "15x Longi 550W Hi-MO 6 Explorer Mono",
                        inverter: "1x Huawei SUN2000-8KTL-M1 Three-Phase",
                        battery: "None (Grid-Tied Net-Metering)",
                        mounting: "Trapezoidal Sheet Metal Rail Mount with EPDM Gaskets",
                        sldPermit: "Mandaue City Electrical Permit Stamped",
                        siteAccess: "Loading dock 2 allocated for panel hauling."
                    },
                    checklist: [
                        "Acknowledge assignment dispatch",
                        "Commercial roof access orientation",
                        "Three-phase AC balance check",
                        "Earth grounding resistance test < 5 Ohms",
                        "Anti-islanding switch test preparation"
                    ],
                    siteNotes: "Elevator access available between 8:00 AM and 10:30 AM."
                },
                {
                    id: "APP-1035",
                    applicantId: "APP-1035",
                    customer: "Lim Villa",
                    system: "6.0 kW Hybrid",
                    capacityKwp: 6.0,
                    type: "Hybrid PV + Battery Storage",
                    location: "Lapu-Lapu City",
                    site: "Marigondon, Lapu-Lapu City",
                    region: "Cebu",
                    status: "New Job",
                    date: "Sept 26, 2026 · 9:00 AM",
                    step: "Confirm assignment and coastal weather check",
                    progress: 0,
                    stage: "Pending Installer Confirmation",
                    coordinator: "Engr. Mark Villanueva (+63 917 800 1234)",
                    technicalSpecs: {
                        panels: "11x Jinko Solar 545W Tiger Neo N-Type",
                        inverter: "1x GoodWe 6kW Hybrid Dual-MPPT",
                        battery: "1x 5.12 kWh Pylontech LiFePO4",
                        mounting: "Corrosion-Resistant Marine Grade Clamps",
                        sldPermit: "Lapu-Lapu City PEE SLD Approved",
                        siteAccess: "Resort community pass at gate."
                    },
                    checklist: [
                        "Accept assignment order",
                        "Check weather & wind tolerance (>30km/h)",
                        "DC isolator marine seal check",
                        "Battery ESS clearance verification",
                        "Rapid shutdown orientation"
                    ],
                    siteNotes: "Coastal proximity: verify all anodized rail coatings."
                },
                {
                    id: "APP-1021",
                    applicantId: "APP-1021",
                    customer: "Makati Logistics Hub",
                    system: "15.0 kW Commercial",
                    capacityKwp: 15.0,
                    type: "Three-Phase Grid-Tied PV",
                    location: "Makati City",
                    site: "San Antonio, Makati City",
                    region: "Metro Manila",
                    status: "In Progress",
                    date: "September 16, 2026 · 8:00 AM",
                    step: "String Voc testing and net-metering CT verification",
                    progress: 80,
                    stage: "Testing & Net-Metering Preparation",
                    coordinator: "Ms. Clarisse Santos (+63 917 800 5678)",
                    technicalSpecs: {
                        panels: "28x Canadian Solar 540W HiKu6 Monocrystalline",
                        inverter: "1x SMA Sunny Tripower 15000TL",
                        battery: "None (Commercial Net-Metering Export)",
                        mounting: "Corrugated Galvanized Iron Deck Solar Rails",
                        sldPermit: "Makati City Electrical Inspection Certificate Ready",
                        siteAccess: "Warehouse dock 4 allocated for contractor truck parking."
                    },
                    checklist: [
                        "String Voc and Isc verification with solar irradiance meter",
                        "Insulation resistance (megger) test on all DC cables",
                        "Inverter grid synchronization & anti-islanding trip check",
                        "Bi-directional net-metering CT installation verification",
                        "Hazard warning decals applied to all inverter and AC breaker boxes"
                    ],
                    siteNotes: "Final Meralco joint commissioning inspection tentatively set for Friday afternoon."
                },
                {
                    id: "APP-1025",
                    applicantId: "APP-1025",
                    customer: "Pasig Auto Spares HQ",
                    system: "8.2 kW Grid-Tied",
                    capacityKwp: 8.2,
                    type: "Grid-Tied Commercial Rooftop",
                    location: "Pasig City",
                    site: "Kapitolyo, Pasig City",
                    region: "Metro Manila",
                    status: "In Progress",
                    date: "September 19, 2026 · 8:00 AM",
                    step: "Inverter mounting and three-phase AC balance test",
                    progress: 65,
                    stage: "Inverter Mounting & AC Stringing",
                    coordinator: "Ms. Clarisse Santos (+63 917 800 5678)",
                    technicalSpecs: {
                        panels: "15x Longi 550W Hi-MO 6 Explorer Mono",
                        inverter: "1x Huawei SUN2000-8KTL-M1 Three-Phase",
                        battery: "None (Grid-Tied with Net-Metering provisions)",
                        mounting: "Trapezoidal Sheet Metal Rail Mount with EPDM Gaskets",
                        sldPermit: "Building Permit & SLD stamped by Pasig City Engineering",
                        siteAccess: "Building freight elevator available between 7:30 AM and 10:00 AM for panel hauling."
                    },
                    checklist: [
                        "Fall protection harnesses & roof anchor verification",
                        "DC cable crimping & UV-resistant conduit routing",
                        "Three-phase inverter AC balance test",
                        "Digital earth resistance tester reading < 5 Ohms",
                        "Anti-islanding test preparation"
                    ],
                    siteNotes: "Main distribution panel is located in basement level B1 near electrical riser 2."
                },
                {
                    id: "APP-1031",
                    applicantId: "APP-1031",
                    customer: "Gomez Solar Facility",
                    system: "5.0 kW Hybrid Storage",
                    capacityKwp: 5.0,
                    type: "Residential Maintenance & Battery Service",
                    location: "Mandaue City",
                    site: "Tipolo, Mandaue City",
                    region: "Cebu",
                    status: "Maintenance",
                    date: "Today, 9:30 AM",
                    step: "Inverter error code diagnosis and ESS firmware flash",
                    progress: 30,
                    stage: "On-Site Diagnostic & Repair",
                    coordinator: "Engr. Mark Villanueva (+63 917 800 1234)",
                    technicalSpecs: {
                        panels: "10x Trina Solar 500W Monocrystalline",
                        inverter: "1x Deye 5kW Hybrid Single-Phase",
                        battery: "1x 5.12 kWh Dyness Wall-Mounted LiFePO4",
                        mounting: "Corrugated Tile Flashings",
                        sldPermit: "Annual Maintenance Certificate on File",
                        siteAccess: "Security gate open. Customer on-site."
                    },
                    checklist: [
                        "Thermal imaging scan of DC disconnect breakers",
                        "Battery management system (BMS) cell balance test",
                        "Firmware upgrade for Deye inverter communication card",
                        "Tighten DC terminal screws to 2.5 Nm spec",
                        "Customer confirmation and sign-off report"
                    ],
                    siteNotes: "Homeowner reported intermittent grid sync fault during peak afternoon heat."
                },
                {
                    id: "APP-1033",
                    applicantId: "APP-1033",
                    customer: "Bautista Residence",
                    system: "5.4 kW Hybrid",
                    capacityKwp: 5.4,
                    type: "Hybrid PV + Battery Storage",
                    location: "Quezon City",
                    site: "Batasan Hills, Quezon City",
                    region: "Metro Manila",
                    status: "Maintenance",
                    date: "September 18, 2026 · 8:30 AM",
                    step: "DC isolator switch inspection and attic conduit repair",
                    progress: 50,
                    stage: "Preventive Maintenance",
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
                        "DC array open-circuit voltage (Voc) verification",
                        "Attic conduit support bracket inspection",
                        "Inverter earth fault check",
                        "Rapid shutdown button actuation test",
                        "Clean glass surface of panel string 1"
                    ],
                    siteNotes: "Homeowner requested conduit routing through rear attic to maintain clean front facade."
                },
                {
                    id: "APP-1018",
                    applicantId: "APP-1018",
                    customer: "Sy Residence",
                    system: "6.5 kW Grid-Tied",
                    capacityKwp: 6.5,
                    type: "Grid-Tied Residential PV",
                    location: "Muntinlupa City",
                    site: "Ayala Alabang Village, Muntinlupa",
                    region: "Metro Manila",
                    status: "Completed",
                    date: "Yesterday",
                    step: "Commissioning report and CFEI sign-off",
                    progress: 100,
                    stage: "Commissioned & Handed Over",
                    coordinator: "Engr. Mark Villanueva (+63 917 800 1234)",
                    technicalSpecs: {
                        panels: "12x JA Solar 545W DeepBlue 3.0",
                        inverter: "1x GoodWe 6kW Single-Phase Dual-MPPT",
                        battery: "None (Grid-tied net-metering)",
                        mounting: "Concrete Spanish Barrel Tile Hooks with Waterproof Sealant",
                        sldPermit: "Muntinlupa Certificate of Final Electrical Inspection (CFEI)",
                        siteAccess: "HOA work permits complete and deposit refunded."
                    },
                    checklist: [
                        "Complete installation report signed by client",
                        "As-built single-line electrical diagram handed over",
                        "Inverter Wi-Fi monitoring app paired with customer phone",
                        "Customer orientation on emergency rapid shutdown completed",
                        "Handover certificate uploaded to Hello Solar portal"
                    ],
                    siteNotes: "Customer commended the neat electrical cable trunking along the exterior wall."
                },
                {
                    id: "APP-1015",
                    applicantId: "APP-1015",
                    customer: "Ridgeview Villa Estates",
                    system: "10.8 kW Hybrid",
                    capacityKwp: 10.8,
                    type: "Hybrid PV + High-Voltage Storage",
                    location: "Taguig City",
                    site: "BGC, Taguig City",
                    region: "Metro Manila",
                    status: "Completed",
                    date: "September 10, 2026",
                    step: "Final commissioning completed",
                    progress: 100,
                    stage: "Handover Completed",
                    coordinator: "Engr. Mark Villanueva (+63 917 800 1234)",
                    technicalSpecs: {
                        panels: "20x Jinko Solar 540W Tiger Neo N-Type",
                        inverter: "1x Growatt SPH 10000TL3-BH-UP Three-Phase",
                        battery: "2x 5.12 kWh Pylontech Force-H2 High Voltage Stack",
                        mounting: "Asphalt Shingle Roof Tile Flashing Brackets",
                        sldPermit: "Cavite PEE Stamped SLD & Barangay Clearance Verified",
                        siteAccess: "Security gate cleared."
                    },
                    checklist: [
                        "Inverter grid synchronization confirmed",
                        "Battery management system paired",
                        "Client handover sign-off",
                        "Meralco net-metering documents submitted",
                        "Warranty documentation provided"
                    ],
                    siteNotes: "System performing at 104% projected output."
                }
            ],
            payouts: []
        };

        cachedData = normalizeData(fallbackBootstrap);
        const savedJobs = loadPersistedJobsState();
        if (savedJobs) {
            cachedData.jobs = savedJobs;
        } else {
            persistJobsState(cachedData.jobs);
        }
        return cachedData;
    }

    /**
     * Returns all active jobs (excluding declined)
     */
    function getJobs(includeDeclined = false) {
        if (!cachedData || !Array.isArray(cachedData.jobs)) return [];
        if (includeDeclined) return cachedData.jobs;
        return cachedData.jobs.filter(j => j.status !== 'Declined');
    }

    /**
     * Finds a single job by id, applicantId, or legacyId
     */
    function getJobById(id) {
        if (!id || !cachedData || !Array.isArray(cachedData.jobs)) return null;
        const needle = String(id).trim().toLowerCase();
        return cachedData.jobs.find(j => 
            String(j.id || '').toLowerCase() === needle ||
            String(j.applicantId || '').toLowerCase() === needle ||
            String(j.legacyId || '').toLowerCase() === needle
        ) || null;
    }

    /**
     * Calculates live KPI counts across categories
     */
    function getKpiCounts() {
        const jobs = getJobs();
        return {
            newJobs: jobs.filter(j => j.status === 'New Job').length,
            inProgress: jobs.filter(j => j.status === 'In Progress').length,
            maintenance: jobs.filter(j => j.status === 'Maintenance').length,
            completed: jobs.filter(j => j.status === 'Completed').length,
            total: jobs.length
        };
    }

    /**
     * Filters jobs by category:
     * - 'new': newly assigned jobs requiring confirmation
     * - 'in_progress': active installation jobs
     * - 'maintenance': repair, inspection, or service work
     * - 'completed': finished installations
     */
    function getJobsByCategory(category) {
        const jobs = getJobs();
        const cat = String(category || '').toLowerCase();
        if (cat === 'new' || cat === 'new jobs' || cat === 'new job') {
            return jobs.filter(j => j.status === 'New Job');
        }
        if (cat === 'in_progress' || cat === 'inprogress' || cat === 'in progress') {
            return jobs.filter(j => j.status === 'In Progress');
        }
        if (cat === 'maintenance' || cat === 'maintenance work') {
            return jobs.filter(j => j.status === 'Maintenance');
        }
        if (cat === 'completed') {
            return jobs.filter(j => j.status === 'Completed');
        }
        return jobs;
    }

    /**
     * Accepts a newly assigned job:
     * - Status changes to 'In Progress'
     * - Removes from New Jobs, updates KPI totals
     * - Persists state
     * - Emits notification
     * - Notifies all subscribers
     */
    function acceptJob(jobId) {
        const job = getJobById(jobId);
        if (!job) return { success: false, error: 'Job not found' };

        job.status = 'In Progress';
        if (job.progress === 0) {
            job.progress = 15;
            job.stage = 'Site Staging & Mobilization';
        }
        job.step = 'Prepare rooftop mounting brackets and confirm site arrival';

        persistJobsState(cachedData.jobs);

        // Dispatch specific operational notification
        if (typeof window !== 'undefined' && window.HelloSolarNotifications && typeof window.HelloSolarNotifications.dispatch === 'function') {
            window.HelloSolarNotifications.dispatch({
                id: `notif-acc-${Date.now()}`,
                recipientRole: 'installer',
                eventType: 'job_accepted',
                recordId: job.applicantId || job.id,
                title: 'Job Accepted',
                message: `${job.applicantId || job.id} moved to In Progress · ${job.location || job.site}`,
                timestamp: new Date().toISOString(),
                targetUrl: `myjob.html?job=${encodeURIComponent(job.applicantId || job.id)}`,
                actionLabel: 'View Work Order'
            });
        }

        notifySubscribers({ type: 'JOB_ACCEPTED', jobId: job.id, job });
        return { success: true, job };
    }

    /**
     * Declines a newly assigned job:
     * - Removes from active installer's New Jobs list
     * - Updates KPI totals
     * - Persists state
     * - Notifies all subscribers
     */
    function declineJob(jobId) {
        const job = getJobById(jobId);
        if (!job) return { success: false, error: 'Job not found' };

        job.status = 'Declined';
        persistJobsState(cachedData.jobs);

        notifySubscribers({ type: 'JOB_DECLINED', jobId: job.id, job });
        return { success: true, job };
    }

    /**
     * Saves user-imported JSON override
     */
    function saveOverride(jsonData) {
        const validation = validateDataset(jsonData);
        if (!validation.valid) return validation;

        try {
            localStorage.setItem(STORAGE_KEY_OVERRIDE, JSON.stringify(jsonData));
            cachedData = normalizeData(jsonData);
            persistJobsState(cachedData.jobs);
            notifySubscribers({ type: 'DATA_RELOADED' });
            return { valid: true };
        } catch (e) {
            return { valid: false, errors: ['Local storage quota exceeded or disabled.'] };
        }
    }

    /**
     * Resets local override and stored jobs state
     */
    function resetOverride() {
        try {
            localStorage.removeItem(STORAGE_KEY_OVERRIDE);
            localStorage.removeItem(STORAGE_KEY_JOBS_STATE);
        } catch (e) {}
        cachedData = null;
        notifySubscribers({ type: 'DATA_RESET' });
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
     * Render semantic status badge:
     * - Maintenance — Red
     * - In Progress — Orange
     * - Completed — Green
     * - New Job — Subtle Blue
     */
    function renderStatusBadge(status) {
        const s = canonicalizeStatus(status);
        let badgeClass = 'badge-progress';
        let label = s;

        if (s === 'Completed') {
            badgeClass = 'badge-success';
        } else if (s === 'In Progress') {
            badgeClass = 'badge-progress';
        } else if (s === 'Maintenance') {
            badgeClass = 'badge-danger';
        } else if (s === 'New Job') {
            badgeClass = 'badge-new';
        } else if (s === 'Declined') {
            badgeClass = 'badge-declined';
        }

        return `<span class="status-badge ${badgeClass}"><span class="badge-dot">●</span> ${escapeHtml(label)}</span>`;
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
        getJobs,
        getJobById,
        getKpiCounts,
        getJobsByCategory,
        acceptJob,
        declineJob,
        subscribe,
        canonicalizeStatus,
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
