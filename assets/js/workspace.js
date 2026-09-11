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
    let userProfile = { fullName: "Engr. Alex Rivera", businessName: "SolarTech Manila Installers" };
    try {
        const stored = localStorage.getItem('hello_solar_installer_user');
        if (stored) {
            userProfile = Object.assign(userProfile, JSON.parse(stored));
        }
    } catch (e) {}

    // Update greeting if present
    const greetingEl = document.getElementById('installerGreeting');
    if (greetingEl) {
        greetingEl.textContent = `Good day, ${userProfile.fullName || 'Installer Team'}`;
    }

    // --------------------------------------------------------------------------
    // 1. MY JOBS VIEW LOGIC (myjob.html)
    // --------------------------------------------------------------------------
    if (isJobPage && document.getElementById('jobsTableBody')) {
        const tableBody = document.getElementById('jobsTableBody');
        const searchInput = document.getElementById('jobSearchInput');
        const statusFilter = document.getElementById('jobStatusFilter');

        // Modal elements
        const jobModal = document.getElementById('jobModal');
        const modalTitle = document.getElementById('modalJobTitle');
        const modalSub = document.getElementById('modalJobSub');
        const modalSpecsGrid = document.getElementById('modalSpecsGrid');
        const modalChecklist = document.getElementById('modalChecklist');
        const modalSiteNotes = document.getElementById('modalSiteNotes');
        const btnSaveJobNotes = document.getElementById('btnSaveJobNotes');
        const modalSupportBtn = document.getElementById('modalSupportBtn');
        const closeJobModalBtn = document.getElementById('closeJobModal');

        let currentActiveJob = null;

        // Render "Next Assignment" Hero Card
        function renderNextAssignmentHero() {
            const heroCard = document.getElementById('nextAssignmentCard');
            if (!heroCard) return;

            // Prioritize in-progress jobs first, then scheduled visits
            const activeJobs = jobs.filter(j => j.status === 'In progress');
            const scheduledJobs = jobs.filter(j => j.status === 'Scheduled');
            const nextJob = activeJobs[0] || scheduledJobs[0] || jobs[0];

            if (!nextJob) {
                heroCard.style.display = 'none';
                return;
            }

            heroCard.style.display = 'flex';
            heroCard.innerHTML = `
                <div class="next-assignment-content">
                    <div class="next-assignment-badge">
                        <span class="pulse-dot"></span> Next Scheduled Assignment
                    </div>
                    <div class="next-assignment-title">
                        <span>${InstallerData.escapeHtml(nextJob.customer)}</span>
                        <span class="job-id-chip">${InstallerData.escapeHtml(nextJob.id)}</span>
                    </div>
                    <div class="next-assignment-meta">
                        <div class="next-assignment-meta-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>${InstallerData.escapeHtml(nextJob.date)}</span>
                        </div>
                        <div class="next-assignment-meta-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <span>${InstallerData.escapeHtml(nextJob.site)}</span>
                        </div>
                        <div class="next-assignment-meta-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
                            <span>${InstallerData.escapeHtml(nextJob.system)}</span>
                        </div>
                    </div>
                    <div class="next-assignment-step">
                        <strong style="color: var(--solar-orange); font-size: 11.5px; text-transform: uppercase;">Next Action:</strong>
                        <span>${InstallerData.escapeHtml(nextJob.step || 'Inspect structural rafters and mounting rails')}</span>
                    </div>
                </div>
                <div class="next-assignment-actions">
                    <button type="button" class="btn-action btn-action-primary" data-job-id="${nextJob.id}" style="padding: 10px 20px; font-size: 13.5px;">
                        View Job Details →
                    </button>
                </div>
            `;
        }

        // Render distinct non-repeating KPI counts
        function renderJobKpis() {
            const schedCount = jobs.filter(j => j.status === 'Scheduled').length;
            const inProgCount = jobs.filter(j => j.status === 'In progress').length;
            const compCount = jobs.filter(j => j.status === 'Completed').length;

            if (document.getElementById('statScheduled')) document.getElementById('statScheduled').textContent = schedCount;
            if (document.getElementById('statInProgress')) document.getElementById('statInProgress').textContent = inProgCount;
            if (document.getElementById('statCompleted')) document.getElementById('statCompleted').textContent = compCount;
        }

        function filterJobs() {
            const query = (searchInput?.value || '').toLowerCase().trim();
            const status = statusFilter?.value || 'ALL';

            return jobs.filter(job => {
                const matchesStatus = (status === 'ALL' || job.status === status);
                const textHaystack = [
                    job.id,
                    job.customer,
                    job.system,
                    job.site,
                    job.region,
                    job.step,
                    job.stage
                ].join(' ').toLowerCase();

                const matchesQuery = !query || textHaystack.includes(query);
                return matchesStatus && matchesQuery;
            });
        }

        function renderJobsTable() {
            const filtered = filterJobs();

            if (filtered.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7">
                            <div class="table-empty">
                                <strong>No matching installation jobs found</strong>
                                <p>Try clearing your search query or choosing "All Statuses".</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = filtered.map(job => {
                return `
                    <tr>
                        <td data-label="Project & Customer">
                            <div class="cell-primary">
                                <span>${InstallerData.escapeHtml(job.customer)}</span>
                                <span class="cell-sub" style="font-family: monospace;">${InstallerData.escapeHtml(job.id)}</span>
                            </div>
                        </td>
                        <td data-label="System & Capacity">
                            <div class="cell-primary">
                                <span>${InstallerData.escapeHtml(job.system)}</span>
                                <span class="cell-sub">${InstallerData.escapeHtml(job.type || 'Solar PV')}</span>
                            </div>
                        </td>
                        <td data-label="Site Location">
                            <div class="cell-primary">
                                <span>${InstallerData.escapeHtml(job.site)}</span>
                                <span class="cell-sub">${InstallerData.escapeHtml(job.region)}</span>
                            </div>
                        </td>
                        <td data-label="Current Stage">
                            <div class="cell-primary" style="gap: 6px;">
                                <span style="font-size: 12px; color: var(--navy); font-weight: 600;">${InstallerData.escapeHtml(job.stage || job.step)}</span>
                                <div class="mini-progress-wrap">
                                    <div class="mini-progress-bar">
                                        <div class="mini-progress-fill" style="width: ${job.progress}%;"></div>
                                    </div>
                                    <span class="mini-progress-text">${job.progress}%</span>
                                </div>
                            </div>
                        </td>
                        <td data-label="Schedule">
                            <span style="font-weight: 600; font-size: 12.5px; color: var(--navy);">${InstallerData.escapeHtml(job.date)}</span>
                        </td>
                        <td data-label="Status">
                            ${InstallerData.renderStatusBadge(job.status)}
                        </td>
                        <td data-label="Action" style="text-align: right;">
                            <button type="button" class="btn-action" data-job-id="${job.id}">
                                View Details
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function openJobModal(jobId) {
            const job = jobs.find(j => j.id === jobId);
            if (!job) return;
            currentActiveJob = job;

            modalTitle.textContent = `${job.customer} (${job.id})`;
            modalSub.textContent = `${job.system} · ${job.site}`;

            const specs = job.technicalSpecs || {};
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
                    <span class="spec-label">Assigned Coordinator</span>
                    <span class="spec-value">${InstallerData.escapeHtml(job.coordinator || 'Hello Solar Dispatch (+63 917 800 1234)')}</span>
                </div>
                <div class="spec-item">
                    <span class="spec-label">Approved SLD & Permit</span>
                    <span class="spec-value">${InstallerData.escapeHtml(specs.sldPermit || 'PEE-Stamped SLD on site')}</span>
                </div>
                <div class="spec-item full">
                    <span class="spec-label">Site Access Instructions</span>
                    <span class="spec-value" style="color: var(--navy); font-weight: 500;">
                        ${InstallerData.escapeHtml(specs.siteAccess || 'Present Hello Solar contractor ID at main village gate.')}
                    </span>
                </div>
            `;

            // Preparation checklist: load saved checks from localStorage per job
            const checklistItems = job.checklist && job.checklist.length > 0 ? job.checklist : defaultChecklist;
            let savedChecks = {};
            try {
                savedChecks = JSON.parse(localStorage.getItem(`hello_solar_installer_checklist_${job.id}`) || '{}');
            } catch (e) {}

            modalChecklist.innerHTML = checklistItems.map((item, idx) => {
                const isChecked = savedChecks[idx] ? 'checked' : '';
                return `
                    <label class="checklist-item">
                        <input type="checkbox" data-check-index="${idx}" ${isChecked}>
                        <span>${InstallerData.escapeHtml(item)}</span>
                    </label>
                `;
            }).join('');

            // Site installation notes (local storage per job)
            const savedNotes = localStorage.getItem(`hello_solar_installer_notes_${job.id}`) || job.siteNotes || '';
            modalSiteNotes.value = savedNotes;

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

        // Save local notes and checklist
        if (btnSaveJobNotes) {
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

        // Event delegation for opening job modal
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-job-id]');
            if (btn) {
                openJobModal(btn.getAttribute('data-job-id'));
            }
        });

        if (searchInput) searchInput.addEventListener('input', renderJobsTable);
        if (statusFilter) statusFilter.addEventListener('change', renderJobsTable);

        if (closeJobModalBtn) closeJobModalBtn.addEventListener('click', closeJobModal);
        if (jobModal) {
            jobModal.addEventListener('click', (e) => {
                if (e.target === jobModal) closeJobModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && jobModal && jobModal.classList.contains('open')) {
                closeJobModal();
            }
        });

        // Global opener for deep links and notifications
        window.openInstallerJobModal = openJobModal;

        // Render initial view
        renderNextAssignmentHero();
        renderJobKpis();
        renderJobsTable();

        // Check for deep link in query string (?job=JOB-2026-081)
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

        // Modal elements
        const payoutModal = document.getElementById('payoutModal');
        const closePayoutModalBtn = document.getElementById('closePayoutModal');
        const btnClosePayoutModal = document.getElementById('btnClosePayoutModal');
        const modalGrossAmount = document.getElementById('modalGrossAmount');
        const modalCwtDeduction = document.getElementById('modalCwtDeduction');
        const modalNetAmount = document.getElementById('modalNetAmount');
        const modalJobRef = document.getElementById('modalJobRef');
        const modalPayoutStatus = document.getElementById('modalPayoutStatus');
        const modalPayoutDate = document.getElementById('modalPayoutDate');
        const modalBankRef = document.getElementById('modalBankRef');
        const modalPayoutNote = document.getElementById('modalPayoutNote');
        const modalPayoutSupportBtn = document.getElementById('modalPayoutSupportBtn');

        // Render Payout KPI cards
        function renderPayoutKpis() {
            const totalPaid = payouts
                .filter(p => p.status === 'Paid')
                .reduce((sum, p) => sum + (p.netAmount || 0), 0);

            const totalPending = payouts
                .filter(p => p.status === 'Pending review')
                .reduce((sum, p) => sum + (p.netAmount || 0), 0);

            // Look for next scheduled or estimated payout release
            const scheduledPayout = payouts.find(p => p.status === 'Scheduled') ||
                payouts.find(p => p.status === 'Pending review' && p.date);
            const nextReleaseText = scheduledPayout ? scheduledPayout.date : 'None scheduled';

            if (document.getElementById('statPaidTotal')) document.getElementById('statPaidTotal').textContent = InstallerData.formatMoney(totalPaid);
            if (document.getElementById('statPendingTotal')) document.getElementById('statPendingTotal').textContent = InstallerData.formatMoney(totalPending);
            if (document.getElementById('statNextRelease')) document.getElementById('statNextRelease').textContent = nextReleaseText;
        }

        function filterPayouts() {
            const query = (searchInput?.value || '').toLowerCase().trim();
            const status = statusFilter?.value || 'ALL';

            return payouts.filter(p => {
                const matchesStatus = (status === 'ALL' || p.status === status);
                const textHaystack = [
                    p.id,
                    p.jobId,
                    p.customer,
                    p.milestone,
                    p.bank,
                    p.refCode,
                    p.status,
                    p.date
                ].join(' ').toLowerCase();

                const matchesQuery = !query || textHaystack.includes(query);
                return matchesStatus && matchesQuery;
            });
        }

        function renderPayoutsTable() {
            const filtered = filterPayouts();

            if (filtered.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8">
                            <div class="table-empty">
                                <strong>No matching payout records found</strong>
                                <p>Try another search query or adjust your status filter.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = filtered.map(p => {
                return `
                    <tr>
                        <td data-label="Payout Ref">
                            <div class="cell-primary">
                                <span style="font-family: monospace; font-size: 13px; font-weight: 700;">${InstallerData.escapeHtml(p.id)}</span>
                                <span class="cell-sub">${InstallerData.escapeHtml(p.jobId)}</span>
                            </div>
                        </td>
                        <td data-label="Related Job">
                            <div class="cell-primary">
                                <span>${InstallerData.escapeHtml(p.customer || 'Client Site')}</span>
                                <span class="cell-sub">${InstallerData.escapeHtml(p.milestone || 'Milestone')}</span>
                            </div>
                        </td>
                        <td data-label="Amount">
                            <strong style="font-size: 14px; color: #059669;">${InstallerData.formatMoney(p.netAmount)}</strong>
                        </td>
                        <td data-label="Status">
                            ${InstallerData.renderStatusBadge(p.status)}
                        </td>
                        <td data-label="Release Date">
                            <span style="font-size: 12.5px; color: var(--navy); font-weight: 600;">${InstallerData.escapeHtml(p.date)}</span>
                        </td>
                        <td data-label="Action" style="text-align: right;">
                            <button type="button" class="btn-action" data-payout-id="${p.id}">
                                View Breakdown
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function openPayoutModal(payoutId) {
            const p = payouts.find(item => item.id === payoutId);
            if (!p) return;

            modalGrossAmount.textContent = InstallerData.formatMoney(p.grossAmount);
            modalCwtDeduction.textContent = `- ${InstallerData.formatMoney(p.cwtDeduction)} (2% BIR CWT)`;
            modalNetAmount.textContent = InstallerData.formatMoney(p.netAmount);

            modalJobRef.textContent = `${p.jobId} · ${p.customer || 'Project Site'}`;
            modalPayoutStatus.innerHTML = InstallerData.renderStatusBadge(p.status);
            modalPayoutDate.textContent = p.date;
            modalBankRef.textContent = p.refCode || 'Pending transfer batch';
            modalPayoutNote.textContent = p.note || 'Milestone labor payout recorded for field technical operations.';

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

        // Export ONLY currently filtered payouts
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

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-payout-id]');
            if (btn) {
                openPayoutModal(btn.getAttribute('data-payout-id'));
            }
        });

        if (searchInput) searchInput.addEventListener('input', renderPayoutsTable);
        if (statusFilter) statusFilter.addEventListener('change', renderPayoutsTable);

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
            } catch (e) {}
        }

        // Attach auto-save to input & change events
        [topicSelect, refInput, subjectInput, detailsInput].forEach(field => {
            if (field) {
                field.addEventListener('input', autoSaveDraft);
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
        } catch (e) {}

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

        // Category Cards click handlers
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const cat = card.getAttribute('data-category');
                if (cat && topicSelect) {
                    for (let i = 0; i < topicSelect.options.length; i++) {
                        if (topicSelect.options[i].value.toLowerCase().includes(cat.toLowerCase())) {
                            topicSelect.selectedIndex = i;
                            break;
                        }
                    }
                    autoSaveDraft();
                    subjectInput?.focus();
                }
            });
        });

        // Manual Save Draft action
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                autoSaveDraft();
                if (statusMsg) {
                    statusMsg.textContent = '✓ Draft saved locally. Note: Nothing has been sent to dispatch yet.';
                    statusMsg.style.color = '#059669';
                    setTimeout(() => { if (statusMsg) statusMsg.textContent = ''; }, 4000);
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

            if (filtered.length === 0) {
                faqList.innerHTML = `
                    <div class="table-empty" style="padding: 24px 10px;">
                        <strong>No answers match your search</strong>
                        <p>Try searching for keywords like "schedule", "payout", "CWT", or "accreditation".</p>
                    </div>
                `;
                return;
            }

            faqList.innerHTML = filtered.map(item => `
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
