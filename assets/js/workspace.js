/**
 * ==========================================================================
 * HELLO SOLAR INSTALLER PORTAL — WORKSPACE INTERACTION MANAGER
 * Orchestrates My Jobs, Payouts, Support views, and JSON preview loader.
 * Features:
 * - Next Assignment hero answering "What is my next assignment & what do I need to do?"
 * - Search & status filters with instant update
 * - Filtered CSV export
 * - Interactive checklist and local job notes persistence
 * - Support draft auto-preservation on input/change
 * - Deep linking via URL query parameters
 * - Compact JSON preview loader with schema validation and instant re-render
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    const path = window.location.pathname.split('/').pop() || 'myjob.html';
    const isJobPage = path === 'myjob.html' || path === '' || path === 'index.html';
    const isPayoutPage = path === 'payout.html';
    const isSupportPage = path === 'support.html';
    const isProfilePage = path === 'profile.html';

    // Load installer dataset from InstallerData module
    let data;
    try {
        data = await InstallerData.loadData();
    } catch (e) {
        console.error('Failed to load installer data:', e);
        data = { jobs: [], payouts: [], checklist: [], faqs: [] };
    }

    let { jobs = [], payouts = [], checklist: defaultChecklist = [], faqs = [], sop = [] } = data;

    // Load active profile from localStorage to update greetings and topbar
    let userProfile = { fullName: "Alex Rivera", businessName: "SolarTech Installer" };
    try {
        const stored = localStorage.getItem('hello_solar_installer_user');
        if (stored) {
            userProfile = Object.assign(userProfile, JSON.parse(stored));
        }
    } catch (e) { }

    // Update greeting if present
    const greetingEl = document.getElementById('installerGreeting');
    if (greetingEl) {
        greetingEl.textContent = `Welcome back, ${userProfile.fullName || 'Installer Team'}`;
    }

    // --------------------------------------------------------------------------
    // 1. MY JOBS VIEW LOGIC (myjob.html)
    // --------------------------------------------------------------------------
    if (isJobPage && document.getElementById('jobsTableBody')) {
        const tableBody = document.getElementById('jobsTableBody');
        const searchInput = document.getElementById('jobSearchInput');
        const statusFilter = document.getElementById('jobStatusFilter');

        // Modal elements: 6-Tier Job Details
        const jobModal = document.getElementById('jobModal');
        const modalTitle = document.getElementById('modalJobTitle');
        const modalSub = document.getElementById('modalJobSub');
        const modalSpecsGrid = document.getElementById('modalSpecsGrid');
        const modalChecklist = document.getElementById('modalChecklist');
        const modalSiteNotes = document.getElementById('modalSiteNotes');
        const btnSaveJobNotes = document.getElementById('btnSaveJobNotes');
        const modalSupportBtn = document.getElementById('modalSupportBtn');
        const closeJobModalBtn = document.getElementById('closeJobModal');
        const btnCloseJobModalFooter = document.getElementById('btnCloseJobModalFooter');

        // KPI Modal elements
        const kpiModal = document.getElementById('kpiModal');
        const modalKpiTitle = document.getElementById('modalKpiTitle');
        const modalKpiCount = document.getElementById('modalKpiCount');
        const modalKpiSubtitle = document.getElementById('modalKpiSubtitle');
        const modalKpiList = document.getElementById('modalKpiList');
        const closeKpiModalBtn = document.getElementById('closeKpiModal');

        // KPI Card Buttons
        const kpiCardNewJobs = document.getElementById('kpiCardNewJobs');
        const kpiCardInProgress = document.getElementById('kpiCardInProgress');
        const kpiCardMaintenance = document.getElementById('kpiCardMaintenance');

        let currentActiveJob = null;
        let isJobsExpanded = false;
        let activeKpiCategory = null;

        function parseJobDate(dateStr) {
            if (!dateStr) return 0;
            const cleaned = dateStr.replace(/·/g, ' ').replace(/\s+/g, ' ').trim();
            const ts = Date.parse(cleaned);
            if (!isNaN(ts)) return ts;
            const match = cleaned.match(/([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/);
            if (match) {
                return new Date(`${match[1]} ${match[2]}, ${match[3]}`).getTime();
            }
            return 0;
        }

        // Render exactly 3 core KPI metrics from centralized store: New Jobs, In Progress, Maintenance Work
        function renderJobKpis() {
            const counts = InstallerData.getKpiCounts();

            const statNewEl = document.getElementById('statNewJobs');
            const statInProgEl = document.getElementById('statInProgress');
            const statMaintEl = document.getElementById('statMaintenance');

            if (statNewEl) statNewEl.textContent = counts.newJobs;
            if (statInProgEl) statInProgEl.textContent = counts.inProgress;
            if (statMaintEl) statMaintEl.textContent = counts.maintenance;
        }

        // Returns human-friendly metadata for KPI categories
        function getCategoryMeta(cat) {
            const c = String(cat || '').toLowerCase();
            if (c === 'new' || c === 'new jobs' || c === 'new job') {
                return {
                    title: 'New Jobs',
                    subtitle: 'Review newly dispatched assignments requiring confirmation.',
                    emptyTitle: 'No New Jobs',
                    emptyText: 'All incoming job assignments have been reviewed.'
                };
            }
            if (c === 'in_progress' || c === 'inprogress' || c === 'in progress') {
                return {
                    title: 'In Progress Jobs',
                    subtitle: 'Currently ongoing rooftop solar installations and tasks.',
                    emptyTitle: 'No Jobs In Progress',
                    emptyText: 'No installations are currently in active execution.'
                };
            }
            if (c === 'maintenance' || c === 'maintenance work') {
                return {
                    title: 'Maintenance Work',
                    subtitle: 'Service repairs, inverter checks & scheduled maintenance.',
                    emptyTitle: 'No Maintenance Jobs',
                    emptyText: 'All system maintenance tickets have been resolved.'
                };
            }
            return {
                title: 'Jobs',
                subtitle: 'Assigned installation and maintenance jobs.',
                emptyTitle: 'No Jobs Found',
                emptyText: 'No jobs currently match this category.'
            };
        }

        // Renders contents of the KPI category modal
        function renderKpiModalContent(category) {
            if (!modalKpiList) return;
            const meta = getCategoryMeta(category);
            const categoryJobs = InstallerData.getJobsByCategory(category);

            if (modalKpiTitle) modalKpiTitle.textContent = meta.title;
            if (modalKpiSubtitle) modalKpiSubtitle.textContent = meta.subtitle || 'Review assigned projects';
            if (modalKpiCount) modalKpiCount.textContent = `${categoryJobs.length} ${categoryJobs.length === 1 ? 'Job' : 'Jobs'}`;

            if (categoryJobs.length === 0) {
                modalKpiList.innerHTML = `
                    <div class="kpi-modal-empty">
                        <div class="kpi-empty-icon-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="m9 12 2 2 4-4"/>
                            </svg>
                        </div>
                        <h4>${InstallerData.escapeHtml(meta.emptyTitle || 'No Jobs')}</h4>
                        <p>${InstallerData.escapeHtml(meta.emptyText || 'No jobs currently belong to this category.')}</p>
                    </div>
                `;
                return;
            }

            modalKpiList.innerHTML = categoryJobs.map(job => {
                const isNew = category === 'new';
                const jobIdText = InstallerData.escapeHtml(job.applicantId || job.id);
                const customerText = job.customer ? InstallerData.escapeHtml(job.customer) : '';
                const locationText = InstallerData.escapeHtml(job.location || job.site || 'Site Location');
                const systemText = InstallerData.escapeHtml(job.system || 'Solar System');
                const dateText = InstallerData.escapeHtml(job.date || 'Scheduled Date');

                return `
                    <div class="kpi-job-item" data-item-job-id="${InstallerData.escapeHtml(job.id)}">
                        <div class="kpi-job-card-header">
                            <div class="kpi-job-title-group">
                                <button type="button" class="kpi-job-id-btn" data-job-id="${InstallerData.escapeHtml(job.id)}" title="Click to view full job details">
                                    <span class="kpi-id-text">${jobIdText}</span>
                                </button>
                                ${customerText ? `<span class="kpi-job-customer">${customerText}</span>` : ''}
                            </div>
                            <div class="kpi-job-badge-wrap">
                                ${InstallerData.renderStatusBadge(job.status)}
                            </div>
                        </div>

                        <div class="kpi-job-meta-grid">
                            <div class="kpi-meta-item" title="Location">
                                <svg class="kpi-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1-18 0c0-7 9-13 9-13s9 6 9 13z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                <span class="kpi-meta-text">${locationText}</span>
                            </div>
                            <div class="kpi-meta-item" title="System Specifications">
                                <svg class="kpi-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                </svg>
                                <span class="kpi-meta-text">${systemText}</span>
                            </div>
                            <div class="kpi-meta-item" title="Scheduled Appointment">
                                <svg class="kpi-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                <span class="kpi-meta-text">${dateText}</span>
                            </div>
                        </div>

                        <div class="kpi-job-actions">
                            ${isNew ? `
                                <button type="button" class="btn-job-action btn-job-accept" data-job-id="${InstallerData.escapeHtml(job.id)}" title="Accept job assignment">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                    <span>Accept</span>
                                </button>
                                <button type="button" class="btn-job-action btn-job-decline" data-job-id="${InstallerData.escapeHtml(job.id)}" title="Decline job assignment">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                    <span>Decline</span>
                                </button>
                            ` : `
                                <button type="button" class="btn-action btn-view-job-details" data-job-id="${InstallerData.escapeHtml(job.id)}" aria-label="View details for ${jobIdText}">
                                    <span>View Details</span>
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="9 18 15 12 9 6"/>
                                    </svg>
                                </button>
                            `}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function openKpiModal(category) {
            if (!kpiModal) return;
            activeKpiCategory = category;
            renderKpiModalContent(category);
            kpiModal.classList.add('open');
            kpiModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeKpiModal() {
            if (!kpiModal) return;
            kpiModal.classList.remove('open');
            kpiModal.setAttribute('aria-hidden', 'true');
            if (!jobModal || !jobModal.classList.contains('open')) {
                document.body.style.overflow = '';
            }
            activeKpiCategory = null;
        }

        function filterJobs() {
            const currentJobs = InstallerData.getJobs();
            const query = (searchInput?.value || '').toLowerCase().trim();
            const selectedStatus = (statusFilter?.value || 'ALL');

            return currentJobs.filter(job => {
                let matchesStatus = true;
                if (selectedStatus !== 'ALL') {
                    matchesStatus = (job.status || '').toLowerCase() === selectedStatus.toLowerCase();
                }
                const textHaystack = [
                    job.id,
                    job.applicantId,
                    job.customer,
                    job.system,
                    job.site,
                    job.location,
                    job.region,
                    job.step,
                    job.stage,
                    job.status
                ].join(' ').toLowerCase();

                const matchesQuery = !query || textHaystack.includes(query);
                return matchesStatus && matchesQuery;
            });
        }

        // Render Primary Section: Assigned Jobs Table (Applicant ID | Status | Action)
        function renderJobsTable() {
            const filtered = filterJobs();
            const total = filtered.length;
            const paginationFooter = document.getElementById('jobsPaginationFooter');
            const seeMoreText = document.getElementById('seeMoreJobsText');
            const toggleBtn = document.getElementById('btnToggleJobsExpand');

            // Limit to 3 items initially unless expanded
            const visibleJobs = (!isJobsExpanded && total > 3) ? filtered.slice(0, 3) : filtered;

            if (paginationFooter) {
                if (total > 3) {
                    paginationFooter.style.display = 'flex';
                    if (isJobsExpanded) {
                        if (seeMoreText) seeMoreText.textContent = 'See less';
                        toggleBtn?.classList.add('expanded');
                    } else {
                        if (seeMoreText) seeMoreText.textContent = 'See more';
                        toggleBtn?.classList.remove('expanded');
                    }
                } else {
                    paginationFooter.style.display = 'none';
                }
            }

            if (total === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="3">
                            <div class="table-empty">
                                <strong>No matching installation jobs found</strong>
                                <p>Try selecting "All Jobs" in the filter.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = visibleJobs.map(job => {
                const isNew = job.status === 'New Job';
                return `
                    <tr>
                        <td data-label="Applicant ID">
                            <button type="button" class="cell-applicant-link" data-job-id="${InstallerData.escapeHtml(job.id)}" aria-label="View job details for ${InstallerData.escapeHtml(job.applicantId || job.id)}">
                                <span class="applicant-id-text">${InstallerData.escapeHtml(job.applicantId || job.id)}</span>
                                <span class="applicant-location-sub">${InstallerData.escapeHtml(job.location || job.site)}</span>
                            </button>
                        </td>
                        <td data-label="Status">
                            ${InstallerData.renderStatusBadge(job.status)}
                        </td>
                        <td data-label="Action">
                            ${isNew ? `
                                <div class="job-action-buttons">
                                    <button type="button" class="btn-job-action btn-job-accept" data-job-id="${InstallerData.escapeHtml(job.id)}" title="Accept job assignment">
                                        Accept
                                    </button>
                                    <button type="button" class="btn-job-action btn-job-decline" data-job-id="${InstallerData.escapeHtml(job.id)}" title="Decline job assignment">
                                        Decline
                                    </button>
                                </div>
                            ` : `
                                <div class="job-action-buttons">
                                    <button type="button" class="btn-action btn-view-job-details" data-job-id="${InstallerData.escapeHtml(job.id)}" aria-label="View job details for ${InstallerData.escapeHtml(job.applicantId || job.id)}">
                                        View
                                    </button>
                                </div>
                            `}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Render Secondary Section: Today's Tasks
        function renderTodaysTasks() {
            const tasksTableBody = document.getElementById('todaysTasksTableBody');
            if (!tasksTableBody) return;

            // Pick active upcoming tasks (not completed), sorted by date
            const activeJobs = jobs
                .filter(j => j.status !== 'Completed' && j.step)
                .slice()
                .sort((a, b) => parseJobDate(a.date) - parseJobDate(b.date));

            if (activeJobs.length === 0) {
                tasksTableBody.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="table-empty">
                                <strong>All assigned tasks completed</strong>
                                <p>No immediate field tasks require your attention today.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tasksTableBody.innerHTML = activeJobs.map(job => {
                return `
                    <tr>
                        <td data-label="Visit / Date">
                            <span class="job-schedule-date">${InstallerData.escapeHtml(job.date)}</span>
                        </td>
                        <td data-label="Task / Next Step">
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="font-weight: 700; color: var(--navy); font-size: 13.5px;">${InstallerData.escapeHtml(job.step)}</span>
                                <span style="font-size: 11.5px; color: var(--gray-500);">${InstallerData.escapeHtml(job.stage || 'Field Preparation')}</span>
                            </div>
                        </td>
                        <td data-label="Customer & Site">
                            <div class="cell-primary">
                                <span class="job-customer-name">${InstallerData.escapeHtml(job.customer)}</span>
                                <span class="cell-sub">${InstallerData.escapeHtml(job.site)}</span>
                            </div>
                        </td>
                        <td data-label="Status">
                            ${InstallerData.renderStatusBadge(job.status)}
                        </td>
                        <td data-label="Action" style="text-align: right;">
                            <button type="button" class="btn-action btn-view-job-details" data-job-id="${job.id}">
                                Open
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Populates 6-Tier Organized Job Details Modal
        function openJobModal(jobId) {
            const job = InstallerData.getJobById(jobId) || jobs.find(j => j.id === jobId);
            if (!job) return;
            currentActiveJob = job;

            // 1. Header
            const modalJobIdEl = document.getElementById('modalJobId');
            if (modalJobIdEl) modalJobIdEl.textContent = job.applicantId || job.id;
            modalTitle.textContent = `${job.applicantId || job.id} — ${job.customer}`;
            modalSub.textContent = `${job.system} · ${job.location || job.site}`;

            // 2. Current Status & Schedule
            const modalJobStatus = document.getElementById('modalJobStatus');
            if (modalJobStatus) modalJobStatus.innerHTML = InstallerData.renderStatusBadge(job.status);
            const modalJobDate = document.getElementById('modalJobDate');
            if (modalJobDate) modalJobDate.textContent = job.date;

            // 3. Next Task Highlight
            const modalJobNextTask = document.getElementById('modalJobNextTask');
            if (modalJobNextTask) modalJobNextTask.textContent = job.step || 'Proceed with approved installation guidelines';

            // 4. Job Snapshot
            const modalSnapshotSystem = document.getElementById('modalSnapshotSystem');
            if (modalSnapshotSystem) modalSnapshotSystem.textContent = `${job.system} (${job.capacityKwp || 5.0} kWp)`;
            const modalSnapshotCoord = document.getElementById('modalSnapshotCoord');
            if (modalSnapshotCoord) modalSnapshotCoord.textContent = job.coordinator || 'Hello Solar Dispatch (+63 917 800 1234)';
            const modalSnapshotAccess = document.getElementById('modalSnapshotAccess');
            const specs = job.technicalSpecs || {};
            if (modalSnapshotAccess) {
                modalSnapshotAccess.textContent = `${job.site}, ${job.region || ''} — ${specs.siteAccess || 'Present Hello Solar contractor ID at main village gate.'}`;
            }

            // 5. Installation Progress
            const modalProgressPct = document.getElementById('modalProgressPct');
            if (modalProgressPct) modalProgressPct.textContent = `${job.progress}%`;
            const modalProgressBar = document.getElementById('modalProgressBar');
            if (modalProgressBar) modalProgressBar.style.width = `${job.progress}%`;
            const modalProgressStage = document.getElementById('modalProgressStage');
            if (modalProgressStage) modalProgressStage.textContent = job.stage || 'In progress';

            // 6. Technical Specifications Grid (if present)
            if (modalSpecsGrid) {
                modalSpecsGrid.innerHTML = `
                    <div class="spec-item">
                        <span class="spec-label">Solar Modules</span>
                        <span class="spec-value">${InstallerData.escapeHtml(specs.panels || 'PV Modules on specification')}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Inverter Hardware</span>
                        <span class="spec-value">${InstallerData.escapeHtml(specs.inverter || 'On-grid inverter')}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Battery ESS</span>
                        <span class="spec-value">${InstallerData.escapeHtml(specs.battery || 'None (Grid-tied net-metering)')}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Rooftop Mounting</span>
                        <span class="spec-value">${InstallerData.escapeHtml(specs.mounting || 'Standard aluminum rail mount')}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Approved SLD & Permit</span>
                        <span class="spec-value">${InstallerData.escapeHtml(specs.sldPermit || 'PEE-Stamped SLD on site')}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">System Architecture</span>
                        <span class="spec-value">${InstallerData.escapeHtml(job.type || 'Rooftop Solar PV')}</span>
                    </div>
                `;
            }

            // Preparation checklist: load saved checks from localStorage per job (if present)
            if (modalChecklist) {
                const checklistItems = job.checklist && job.checklist.length > 0 ? job.checklist : defaultChecklist;
                let savedChecks = {};
                try {
                    savedChecks = JSON.parse(localStorage.getItem(`hello_solar_installer_checklist_${job.id}`) || '{}');
                } catch (e) { }

                modalChecklist.innerHTML = checklistItems.map((item, idx) => {
                    const isChecked = savedChecks[idx] ? 'checked' : '';
                    return `
                        <label class="checklist-row">
                            <input type="checkbox" data-check-index="${idx}" ${isChecked}>
                            <span>${InstallerData.escapeHtml(item)}</span>
                        </label>
                    `;
                }).join('');
            }

            // Site installation notes (local storage per job) (if present)
            if (modalSiteNotes) {
                const savedNotes = localStorage.getItem(`hello_solar_installer_notes_${job.id}`) || job.siteNotes || '';
                modalSiteNotes.value = savedNotes;
            }

            // Contextual support button
            if (modalSupportBtn) {
                modalSupportBtn.href = `support.html?topic=Site%20Access%20%26%20Scheduling&reference=${encodeURIComponent(job.id)}`;
            }

            jobModal.classList.add('open');
            jobModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeJobModal() {
            if (!jobModal) return;
            jobModal.classList.remove('open');
            jobModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        if (btnCloseJobModalFooter) {
            btnCloseJobModalFooter.addEventListener('click', closeJobModal);
        }

        // Save local notes and checklist
        if (btnSaveJobNotes && modalChecklist && modalSiteNotes) {
            btnSaveJobNotes.addEventListener('click', () => {
                if (!currentActiveJob) return;

                const checks = {};
                modalChecklist.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    const idx = cb.getAttribute('data-check-index');
                    checks[idx] = cb.checked;
                });

                localStorage.setItem(`hello_solar_installer_checklist_${currentActiveJob.id}`, JSON.stringify(checks));
                localStorage.setItem(`hello_solar_installer_notes_${currentActiveJob.id}`, modalSiteNotes.value);

                btnSaveJobNotes.textContent = '✓ Saved Locally';
                btnSaveJobNotes.style.background = '#059669';
                setTimeout(() => {
                    btnSaveJobNotes.textContent = 'Save Notes & Checklist';
                    btnSaveJobNotes.style.background = '';
                }, 1800);
            });
        }

        // Event delegation for Accept, Decline, and View details
        document.addEventListener('click', (e) => {
            const acceptBtn = e.target.closest('.btn-job-accept');
            if (acceptBtn) {
                e.preventDefault();
                e.stopPropagation();
                const jobId = acceptBtn.getAttribute('data-job-id');
                if (jobId) {
                    InstallerData.acceptJob(jobId);
                }
                return;
            }

            const declineBtn = e.target.closest('.btn-job-decline');
            if (declineBtn) {
                e.preventDefault();
                e.stopPropagation();
                const jobId = declineBtn.getAttribute('data-job-id');
                if (jobId) {
                    InstallerData.declineJob(jobId);
                }
                return;
            }

            const viewBtn = e.target.closest('.btn-view-job-details, .cell-applicant-link, .kpi-job-id-btn');
            if (viewBtn) {
                e.preventDefault();
                const jobId = viewBtn.getAttribute('data-job-id');
                if (jobId) {
                    openJobModal(jobId);
                }
                return;
            }
        });

        // KPI Card Triggers
        if (kpiCardNewJobs) {
            kpiCardNewJobs.addEventListener('click', () => openKpiModal('new'));
        }
        if (kpiCardInProgress) {
            kpiCardInProgress.addEventListener('click', () => openKpiModal('in_progress'));
        }
        if (kpiCardMaintenance) {
            kpiCardMaintenance.addEventListener('click', () => openKpiModal('maintenance'));
        }

        // KPI Modal Close Bindings
        if (closeKpiModalBtn) {
            closeKpiModalBtn.addEventListener('click', closeKpiModal);
        }
        if (kpiModal) {
            kpiModal.addEventListener('click', (e) => {
                if (e.target === kpiModal) closeKpiModal();
            });
        }

        const toggleJobsExpandBtn = document.getElementById('btnToggleJobsExpand');
        if (toggleJobsExpandBtn) {
            toggleJobsExpandBtn.addEventListener('click', () => {
                isJobsExpanded = !isJobsExpanded;
                renderJobsTable();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                isJobsExpanded = false;
                renderJobsTable();
            });
        }
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                isJobsExpanded = false;
                renderJobsTable();
            });
        }

        if (closeJobModalBtn) closeJobModalBtn.addEventListener('click', closeJobModal);
        if (jobModal) {
            jobModal.addEventListener('click', (e) => {
                if (e.target === jobModal) closeJobModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (jobModal && jobModal.classList.contains('open')) {
                    closeJobModal();
                }
                if (kpiModal && kpiModal.classList.contains('open')) {
                    closeKpiModal();
                }
            }
        });

        // Global opener for deep links and notifications
        window.openInstallerJobModal = openJobModal;

        // Reactive subscription: auto-updates KPI counts, My Jobs table, and KPI modal if open
        InstallerData.subscribe((evt) => {
            renderJobKpis();
            renderJobsTable();
            if (activeKpiCategory && kpiModal && kpiModal.classList.contains('open')) {
                renderKpiModalContent(activeKpiCategory);
            }
        });

        // Render initial view
        renderJobKpis();
        renderJobsTable();

        // Check for deep link in query string (?job=APP-1024 or ?job=JOB-2026-081)
        const urlParams = new URLSearchParams(window.location.search);
        const deepJob = urlParams.get('job');
        if (deepJob) {
            setTimeout(() => openJobModal(deepJob), 150);
        }
    }

    // --------------------------------------------------------------------------
    // 2. PAYOUTS VIEW LOGIC (payout.html)
    // --------------------------------------------------------------------------
    if (isPayoutPage && document.getElementById('payoutsTableBody')) {
        const tableBody = document.getElementById('payoutsTableBody');
        const searchInput = document.getElementById('payoutSearchInput');
        const statusFilter = document.getElementById('payoutStatusFilter');
        const btnExportCsv = document.getElementById('btnExportCsv');

        let isPayoutsExpanded = false;

        // Modal elements
        const payoutModal = document.getElementById('payoutModal');
        const modalPayoutTitle = document.getElementById('modalPayoutTitle');
        const modalPayoutSub = document.getElementById('modalPayoutSub');
        const closePayoutModalBtn = document.getElementById('closePayoutModal');
        const btnClosePayoutModal = document.getElementById('btnClosePayoutModal');
        const modalGrossAmount = document.getElementById('modalGrossAmount');
        const modalCwtDeduction = document.getElementById('modalCwtDeduction');
        const modalNetAmount = document.getElementById('modalNetAmount');
        const modalPayoutId = document.getElementById('modalPayoutId');
        const modalJobRef = document.getElementById('modalJobRef');
        const modalMilestoneStage = document.getElementById('modalMilestoneStage');
        const modalPayoutStatus = document.getElementById('modalPayoutStatus');
        const modalPayoutDate = document.getElementById('modalPayoutDate');
        const modalBankRef = document.getElementById('modalBankRef');
        const modalPayoutNote = document.getElementById('modalPayoutNote');
        const modalPayoutSupportBtn = document.getElementById('modalPayoutSupportBtn');

        // Helper to format compact payout dates for the main table (e.g. "Sep 12", "Est. Sep 20")
        function formatCompactPayoutDate(dateStr) {
            if (!dateStr) return '—';
            let s = String(dateStr).trim();
            let prefix = '';
            if (/^estimated\s+/i.test(s)) {
                prefix = 'Est. ';
                s = s.replace(/^estimated\s+/i, '');
            } else if (/^scheduled\s+for\s+/i.test(s)) {
                s = s.replace(/^scheduled\s+for\s+/i, '');
            }
            s = s.replace(/,\s*\d{4}$/, '');
            s = s.replace(/September/gi, 'Sep')
                .replace(/October/gi, 'Oct')
                .replace(/November/gi, 'Nov')
                .replace(/December/gi, 'Dec')
                .replace(/January/gi, 'Jan')
                .replace(/February/gi, 'Feb')
                .replace(/March/gi, 'Mar')
                .replace(/April/gi, 'Apr')
                .replace(/August/gi, 'Aug');
            return prefix + s;
        }

        // Render Payout KPI cards
        function renderPayoutKpis() {
            const totalPaid = payouts
                .filter(p => p.status === 'Paid')
                .reduce((sum, p) => sum + (p.netAmount || 0), 0);

            const totalPending = payouts
                .filter(p => p.status && p.status.toLowerCase() === 'pending review')
                .reduce((sum, p) => sum + (p.netAmount || 0), 0);

            // Look for next scheduled or estimated payout release
            const scheduledPayout = payouts.find(p => p.status === 'Scheduled');
            const pendingPayoutWithDate = payouts.find(p => p.status && p.status.toLowerCase() === 'pending review' && p.date);

            let nextReleaseText = 'None scheduled';
            if (scheduledPayout && scheduledPayout.date) {
                nextReleaseText = scheduledPayout.date.replace(/^Scheduled\s+for\s+/i, '').trim();
            } else if (pendingPayoutWithDate && pendingPayoutWithDate.date) {
                nextReleaseText = pendingPayoutWithDate.date.replace(/^Estimated\s+/i, '').trim();
            }

            const statPaidTotalEl = document.getElementById('statPaidTotal');
            const statPendingTotalEl = document.getElementById('statPendingTotal');
            const statNextReleaseEl = document.getElementById('statNextRelease');
            const statNextReleaseSubEl = document.getElementById('statNextReleaseSub');

            if (statPaidTotalEl) statPaidTotalEl.textContent = InstallerData.formatMoney(totalPaid);
            if (statPendingTotalEl) statPendingTotalEl.textContent = InstallerData.formatMoney(totalPending);
            if (statNextReleaseEl) statNextReleaseEl.textContent = nextReleaseText;
            if (statNextReleaseSubEl) statNextReleaseSubEl.textContent = '';
        }

        function filterPayouts() {
            const status = (statusFilter?.value || 'ALL').trim();
            if (status === 'ALL') return payouts;
            return payouts.filter(p => (p.status || '').toLowerCase() === status.toLowerCase());
        }

        function renderPayoutsTable() {
            const filtered = filterPayouts();
            const total = filtered.length;
            const paginationFooter = document.getElementById('payoutPaginationFooter');
            const seeMoreText = document.getElementById('seeMorePayoutsText');
            const toggleBtn = document.getElementById('btnTogglePayoutsExpand');

            // Limit to 3 items initially unless expanded
            const visiblePayouts = (!isPayoutsExpanded && total > 3) ? filtered.slice(0, 3) : filtered;

            if (paginationFooter) {
                if (total > 3) {
                    paginationFooter.style.display = 'flex';
                    const remaining = total - 3;
                    if (isPayoutsExpanded) {
                        if (seeMoreText) seeMoreText.textContent = 'See less';
                        toggleBtn?.classList.add('expanded');
                    } else {
                        if (seeMoreText) seeMoreText.textContent = 'See more';
                        toggleBtn?.classList.remove('expanded');
                    }
                } else {
                    paginationFooter.style.display = 'none';
                }
            }

            if (total === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="table-empty">
                                <strong>No matching payout records found</strong>
                                <p>Try another filter selection to see other milestones.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = visiblePayouts.map(p => {
                return `
                    <tr>
                        <td data-label="Job">
                            <div class="cell-primary">
                                <span class="payout-customer-name">${InstallerData.escapeHtml(p.customer || 'Client Site')}</span>
                                <span class="cell-sub payout-job-id">${InstallerData.escapeHtml(p.jobId)}</span>
                            </div>
                        </td>
                        <td data-label="Net Amount">
                            <span class="payout-table-amount">${InstallerData.formatMoney(p.netAmount)}</span>
                        </td>
                        <td data-label="Status">
                            ${InstallerData.renderStatusBadge(p.status)}
                        </td>
                        <td data-label="Date">
                            <span class="payout-table-date">${InstallerData.escapeHtml(formatCompactPayoutDate(p.date))}</span>
                        </td>
                        <td data-label="Action">
                            <button type="button" class="btn-action btn-view-payout-breakdown" data-payout-id="${p.id}" aria-label="View breakdown for ${InstallerData.escapeHtml(p.customer)}">
                                View
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function openPayoutModal(payoutId) {
            const p = payouts.find(item => item.id === payoutId);
            if (!p) return;

            if (modalPayoutTitle) modalPayoutTitle.textContent = `Payout Breakdown (${p.id})`;
            if (modalPayoutSub) modalPayoutSub.textContent = `${p.customer || 'Project Site'} · ${p.jobId}`;

            if (modalPayoutId) modalPayoutId.textContent = p.id;
            if (modalMilestoneStage) modalMilestoneStage.textContent = p.milestone || 'Installation Milestone';
            if (modalJobRef) modalJobRef.textContent = `${p.jobId} · ${p.customer || 'Project Site'}`;

            if (modalGrossAmount) modalGrossAmount.textContent = InstallerData.formatMoney(p.grossAmount);
            if (modalCwtDeduction) modalCwtDeduction.textContent = `- ${InstallerData.formatMoney(p.cwtDeduction)} (2% BIR CWT)`;
            if (modalNetAmount) modalNetAmount.textContent = InstallerData.formatMoney(p.netAmount);

            if (modalPayoutStatus) modalPayoutStatus.innerHTML = InstallerData.renderStatusBadge(p.status);
            if (modalPayoutDate) modalPayoutDate.textContent = p.date;
            if (modalBankRef) modalBankRef.textContent = p.refCode || 'Pending transfer batch';
            if (modalPayoutNote) modalPayoutNote.textContent = p.note || 'Milestone labor payout recorded for field technical operations.';

            if (modalPayoutSupportBtn) {
                modalPayoutSupportBtn.href = `support.html?topic=Payout%20%26%20BIR%202307&reference=${encodeURIComponent(p.id)}`;
            }

            payoutModal.classList.add('open');
            payoutModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closePayoutModal() {
            if (!payoutModal) return;
            payoutModal.classList.remove('open');
            payoutModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        // Export ALL matching filtered payouts (including collapsed rows)
        if (btnExportCsv) {
            btnExportCsv.addEventListener('click', () => {
                const filtered = filterPayouts();
                if (filtered.length === 0) {
                    alert('No payout records match the current filter to export.');
                    return;
                }

                const headers = ['Payout ID', 'Job ID', 'Customer', 'Milestone Stage', 'Gross Labor (PHP)', '2% CWT Deduction (PHP)', 'Net Payout (PHP)', 'Status', 'Date', 'Bank Reference', 'Audit Notes'];
                const csvRows = [headers.join(',')];

                filtered.forEach(p => {
                    const row = [
                        `"${p.id}"`,
                        `"${p.jobId}"`,
                        `"${(p.customer || '').replace(/"/g, '""')}"`,
                        `"${(p.milestone || '').replace(/"/g, '""')}"`,
                        p.grossAmount,
                        p.cwtDeduction,
                        p.netAmount,
                        `"${p.status}"`,
                        `"${p.date}"`,
                        `"${p.refCode || ''}"`,
                        `"${(p.note || '').replace(/"/g, '""')}"`
                    ];
                    csvRows.push(row.join(','));
                });

                const csvContent = '\uFEFF' + csvRows.join('\r\n');
                InstallerData.downloadFile(`Hello_Solar_Payouts_${new Date().toISOString().slice(0, 10)}.csv`, csvContent, 'text/csv;charset=utf-8;');
            });
        }

        const togglePayoutsExpandBtn = document.getElementById('btnTogglePayoutsExpand');
        if (togglePayoutsExpandBtn) {
            togglePayoutsExpandBtn.addEventListener('click', () => {
                isPayoutsExpanded = !isPayoutsExpanded;
                renderPayoutsTable();
            });
        }

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-payout-id]');
            if (btn) {
                openPayoutModal(btn.getAttribute('data-payout-id'));
            }
        });

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                isPayoutsExpanded = false;
                renderPayoutsTable();
            });
        }
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                isPayoutsExpanded = false;
                renderPayoutsTable();
            });
        }

        if (closePayoutModalBtn) closePayoutModalBtn.addEventListener('click', closePayoutModal);
        if (btnClosePayoutModal) btnClosePayoutModal.addEventListener('click', closePayoutModal);
        if (payoutModal) {
            payoutModal.addEventListener('click', (e) => {
                if (e.target === payoutModal) closePayoutModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && payoutModal && payoutModal.classList.contains('open')) {
                closePayoutModal();
            }
        });

        window.openInstallerPayoutModal = openPayoutModal;

        renderPayoutKpis();
        renderPayoutsTable();

        const urlParams = new URLSearchParams(window.location.search);
        const deepPayout = urlParams.get('payout');
        if (deepPayout) {
            setTimeout(() => openPayoutModal(deepPayout), 150);
        }
    }

    // --------------------------------------------------------------------------
    // 3. SUPPORT VIEW LOGIC (support.html)
    // --------------------------------------------------------------------------
    if (isSupportPage && document.getElementById('supportForm')) {
        const form = document.getElementById('supportForm');
        const topicSelect = document.getElementById('supportTopic');
        const refInput = document.getElementById('supportRef');
        const subjectInput = document.getElementById('supportSubject');
        const detailsInput = document.getElementById('supportDetails');
        const statusMsg = document.getElementById('supportStatusMsg');
        const btnSaveDraft = document.getElementById('btnSaveDraft');
        const btnDownloadDraft = document.getElementById('btnDownloadDraft');
        const faqList = document.getElementById('faqList');
        const faqSearchInput = document.getElementById('faqSearchInput');
        const faqToggle = document.getElementById('faqToggle');
        let faqsExpanded = false;

        const DRAFT_KEY = 'hello_solar_installer_support_draft';

        // Auto-save helper for preservation across navigation & context changes
        function autoSaveDraft() {
            const draft = {
                topic: topicSelect?.value || '',
                reference: refInput?.value || '',
                subject: subjectInput?.value || '',
                details: detailsInput?.value || '',
                updatedAt: new Date().toISOString()
            };
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
                return true;
            } catch (e) {
                if (statusMsg) {
                    statusMsg.textContent = 'Unable to save on this device. Download your request to keep a copy.';
                    statusMsg.className = 'status-msg-error';
                }
                return false;
            }
        }

        // Attach auto-save to input & change events
        [topicSelect, refInput, subjectInput, detailsInput].forEach(field => {
            if (field) {
                field.addEventListener('input', () => {
                    autoSaveDraft();
                    if (statusMsg && statusMsg.textContent && statusMsg.className === 'status-msg-success') {
                        clearTimeout(statusClearTimer);
                        statusMsg.textContent = '';
                        statusMsg.className = '';
                    }
                });
                field.addEventListener('change', autoSaveDraft);
            }
        });

        // Parse query params for pre-filling
        const params = new URLSearchParams(window.location.search);
        const qTopic = params.get('topic');
        const qRef = params.get('reference');

        // Restore draft from storage
        try {
            const savedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
            if (savedDraft.subject && !subjectInput.value) subjectInput.value = savedDraft.subject;
            if (savedDraft.details && !detailsInput.value) detailsInput.value = savedDraft.details;
            if (savedDraft.reference && !refInput.value) refInput.value = savedDraft.reference;
            if (savedDraft.topic && topicSelect && !qTopic) topicSelect.value = savedDraft.topic;
        } catch (e) { }

        if (qTopic && topicSelect) {
            for (let i = 0; i < topicSelect.options.length; i++) {
                if (topicSelect.options[i].value.toLowerCase().includes(qTopic.toLowerCase())) {
                    topicSelect.selectedIndex = i;
                    break;
                }
            }
        }
        if (qRef && refInput) {
            refInput.value = qRef;
        }

        // --------------------------------------------------------------------------
        // Custom Accessible Dropdown Handler for Support Topic
        // --------------------------------------------------------------------------
        const topicDropdown = document.getElementById('supportTopicDropdown');
        function syncTopicDropdown(val) {
            if (!topicDropdown) return;
            const selectedText = document.getElementById('supportTopicSelected');
            const items = topicDropdown.querySelectorAll('.custom-dropdown-item');
            items.forEach(it => {
                const itemVal = it.getAttribute('data-value');
                if (itemVal === val) {
                    it.classList.add('active');
                    it.setAttribute('aria-selected', 'true');
                    const textEl = it.querySelector('.custom-dropdown-item-text');
                    if (selectedText) selectedText.textContent = textEl ? textEl.textContent.trim() : itemVal;
                } else {
                    it.classList.remove('active');
                    it.setAttribute('aria-selected', 'false');
                }
            });
        }

        if (topicDropdown) {
            const trigger = topicDropdown.querySelector('.custom-dropdown-trigger');
            const items = topicDropdown.querySelectorAll('.custom-dropdown-item');
            const selectedText = topicDropdown.querySelector('.custom-dropdown-selected');

            function toggleTopicDropdown(force) {
                const isOpen = typeof force === 'boolean' ? force : !topicDropdown.classList.contains('open');
                topicDropdown.classList.toggle('open', isOpen);
                if (trigger) trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            }

            if (trigger) {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleTopicDropdown();
                });
                trigger.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleTopicDropdown(true);
                        const activeItem = topicDropdown.querySelector('.custom-dropdown-item.active') || items[0];
                        if (activeItem) activeItem.focus();
                    } else if (e.key === 'Escape') {
                        toggleTopicDropdown(false);
                    }
                });
            }

            items.forEach((item, index) => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const val = item.getAttribute('data-value');
                    const textEl = item.querySelector('.custom-dropdown-item-text');
                    const label = textEl ? textEl.textContent.trim() : val;
                    if (selectedText) selectedText.textContent = label;
                    if (topicSelect) {
                        topicSelect.value = val;
                        topicSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    items.forEach(it => {
                        it.classList.remove('active');
                        it.setAttribute('aria-selected', 'false');
                    });
                    item.classList.add('active');
                    item.setAttribute('aria-selected', 'true');
                    toggleTopicDropdown(false);
                    if (trigger) trigger.focus();
                });

                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        item.click();
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = items[index + 1] || items[0];
                        if (next) next.focus();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev = items[index - 1] || items[items.length - 1];
                        if (prev) prev.focus();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        toggleTopicDropdown(false);
                        if (trigger) trigger.focus();
                    }
                });
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('#supportTopicDropdown')) {
                    toggleTopicDropdown(false);
                }
            });

            if (topicSelect) {
                topicSelect.addEventListener('change', () => syncTopicDropdown(topicSelect.value));
                syncTopicDropdown(topicSelect.value);
            }
        }

        // Common Answers FAQ Modal
        const btnToggleFaq = document.getElementById('btnToggleFaq');
        const faqModal = document.getElementById('faqModal');
        const closeFaqModal = document.getElementById('closeFaqModal');
        const btnCloseFaqModalFooter = document.getElementById('btnCloseFaqModalFooter');

        function openFaqModal() {
            if (!faqModal) return;
            faqModal.classList.add('open');
            faqModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            renderFaqs();
            if (faqSearchInput) setTimeout(() => faqSearchInput.focus(), 150);
        }

        function closeFaqModalDialog() {
            if (!faqModal) return;
            faqModal.classList.remove('open');
            faqModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        if (btnToggleFaq) {
            btnToggleFaq.addEventListener('click', openFaqModal);
        }
        if (closeFaqModal) {
            closeFaqModal.addEventListener('click', closeFaqModalDialog);
        }
        if (btnCloseFaqModalFooter) {
            btnCloseFaqModalFooter.addEventListener('click', closeFaqModalDialog);
        }
        if (faqModal) {
            faqModal.addEventListener('click', (e) => {
                if (e.target === faqModal) closeFaqModalDialog();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && faqModal.classList.contains('open')) {
                    closeFaqModalDialog();
                }
            });
        }

        // Category Cards click handlers (if present)
        const categoryCards = document.querySelectorAll('.category-card');
        if (categoryCards.length > 0) {
            categoryCards.forEach(card => {
                card.setAttribute('role', 'button');
                card.tabIndex = 0;
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        card.click();
                    }
                });
                card.addEventListener('click', () => {
                    const cat = card.getAttribute('data-category');
                    if (cat && topicSelect) {
                        for (let i = 0; i < topicSelect.options.length; i++) {
                            if (topicSelect.options[i].value.toLowerCase().includes(cat.toLowerCase())) {
                                topicSelect.selectedIndex = i;
                                break;
                            }
                        }
                        topicSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        autoSaveDraft();
                        detailsInput?.focus();
                    }
                });
            });

            function updateSelectedCategory() {
                categoryCards.forEach(card => {
                    card.setAttribute('aria-pressed', String(card.dataset.category === topicSelect.value));
                });
            }
            topicSelect.addEventListener('change', updateSelectedCategory);
            categoryCards.forEach(card => card.addEventListener('click', updateSelectedCategory));
            updateSelectedCategory();
        }

        let statusClearTimer = null;

        // Primary Support Submission Action (Send Request)
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const topic = topicSelect?.value || 'Site Access & Scheduling';
                const ref = refInput?.value.trim() || '';
                const details = detailsInput?.value.trim() || '';

                if (!details) {
                    if (statusMsg) {
                        statusMsg.textContent = 'Please tell us what you need help with.';
                        statusMsg.className = 'status-msg-error';
                    }
                    detailsInput?.focus();
                    return;
                }

                // Sync derived subject for backend compatibility
                if (subjectInput) {
                    subjectInput.value = `[${topic}]${ref ? ' ' + ref : ''} Support Request`;
                }

                autoSaveDraft();

                if (statusMsg) {
                    statusMsg.textContent = '✓ Request sent to Hello Solar Dispatch! Our coordinator will review and contact you shortly.';
                    statusMsg.className = 'status-msg-success';
                    clearTimeout(statusClearTimer);
                    statusClearTimer = setTimeout(() => {
                        if (statusMsg) {
                            statusMsg.textContent = '';
                            statusMsg.className = '';
                        }
                    }, 7000);
                }

                if (window.HelloSolarProfile && typeof window.HelloSolarProfile.showToast === 'function') {
                    window.HelloSolarProfile.showToast('Request sent to Hello Solar Dispatch! ✓');
                }
            });
        }

        // Download Request as .txt file
        if (btnDownloadDraft) {
            btnDownloadDraft.addEventListener('click', () => {
                const topic = topicSelect?.value || 'General';
                const ref = refInput?.value.trim() || 'None Specified';
                const subject = subjectInput?.value.trim() || 'Untitled Request';
                const details = detailsInput?.value.trim() || 'No details provided.';

                const content = [
                    'HELLO SOLAR INSTALLER PORTAL — DISPATCH REQUEST',
                    '====================================================',
                    `Generated: ${new Date().toLocaleString('en-PH')}`,
                    `Installer: ${userProfile.fullName || 'Installer Team'} (${userProfile.businessName || 'SolarTech'})`,
                    '',
                    `Inquiry Topic: ${topic}`,
                    `Reference ID:  ${ref}`,
                    `Subject:       ${subject}`,
                    '',
                    'MESSAGE DETAILS:',
                    '----------------------------------------------------',
                    details,
                    '',
                    '====================================================',
                    'NOTE: This draft was generated from your local browser.',
                    'Copy and send via Hello Solar Dispatch SMS / Viber group.'
                ].join('\r\n');

                InstallerData.downloadFile(`Installer_Request_${ref.replace(/[^a-zA-Z0-9]/g, '_')}.txt`, content, 'text/plain;charset=utf-8;');
            });
        }

        // Render Searchable FAQs
        function renderFaqs() {
            if (!faqList) return;
            const query = (faqSearchInput?.value || '').toLowerCase().trim();

            const filtered = faqs.filter(item => {
                if (!query) return true;
                return item.q.toLowerCase().includes(query) ||
                    item.a.toLowerCase().includes(query) ||
                    item.category.toLowerCase().includes(query);
            });

            if (faqToggle) {
                faqToggle.hidden = Boolean(query) || filtered.length <= 3;
                faqToggle.textContent = faqsExpanded ? 'See less' : 'See more';
                faqToggle.setAttribute('aria-expanded', String(faqsExpanded));
            }

            if (filtered.length === 0) {
                faqList.innerHTML = `
                    <div class="table-empty" style="padding: 24px 10px;">
                        <strong>No answers match your search</strong>
                        <p>Try searching for keywords like "schedule", "payout", "CWT", or "accreditation".</p>
                    </div>
                `;
                return;
            }

            const visible = query || faqsExpanded ? filtered : filtered.slice(0, 3);
            faqList.innerHTML = visible.map(item => `
                <details class="faq-item">
                    <summary>
                        <span>${InstallerData.escapeHtml(item.q)}</span>
                        <svg class="accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </summary>
                    <div class="faq-answer">
                        <span style="display: inline-block; font-size: 11px; font-weight: 700; color: var(--solar-orange); text-transform: uppercase; margin-bottom: 6px;">
                            ${InstallerData.escapeHtml(item.category)}
                        </span>
                        <p>${InstallerData.escapeHtml(item.a)}</p>
                    </div>
                </details>
            `).join('');
        }

        if (faqSearchInput) {
            faqSearchInput.addEventListener('input', renderFaqs);
        }
        faqToggle?.addEventListener('click', () => {
            faqsExpanded = !faqsExpanded;
            renderFaqs();
        });

        renderFaqs();
    }

    // --------------------------------------------------------------------------
    // 4. COMPACT PREVIEW DATA LOADER ACCORDION (On all authenticated pages)
    // --------------------------------------------------------------------------
    const jsonFileInput = document.getElementById('jsonFileInput');
    const btnResetJson = document.getElementById('btnResetJsonOverride');
    const jsonStatusAlert = document.getElementById('jsonStatusAlert');

    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    const result = InstallerData.saveOverride(parsed);

                    if (result.valid) {
                        if (jsonStatusAlert) {
                            jsonStatusAlert.className = 'json-status-alert success';
                            jsonStatusAlert.textContent = '✓ Validated and loaded edited installer dataset successfully. Refreshing view...';
                        }
                        setTimeout(() => window.location.reload(), 800);
                    } else {
                        if (jsonStatusAlert) {
                            jsonStatusAlert.className = 'json-status-alert error';
                            jsonStatusAlert.innerHTML = `<strong>Validation Error:</strong><br>${result.errors.join('<br>')}`;
                        }
                    }
                } catch (err) {
                    if (jsonStatusAlert) {
                        jsonStatusAlert.className = 'json-status-alert error';
                        jsonStatusAlert.textContent = `Invalid JSON format: ${err.message}`;
                    }
                }
            };
            reader.readAsText(file);
        });
    }

    if (btnResetJson) {
        btnResetJson.addEventListener('click', () => {
            InstallerData.resetOverride();
            if (jsonStatusAlert) {
                jsonStatusAlert.className = 'json-status-alert success';
                jsonStatusAlert.textContent = 'Reset to default installer.json dataset. Refreshing...';
            }
            setTimeout(() => window.location.reload(), 600);
        });
    }
});
