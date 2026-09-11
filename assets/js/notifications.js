/**
 * ==========================================================================
 * HELLO SOLAR SHARED NOTIFICATION ENGINE — INSTALLER SUITE
 * BroadcastChannel event bus, responsive topbar bell & sliding panel UI,
 * deep-record routing (jobs, payouts, support), unread badge management,
 * and field operations event simulator.
 * ==========================================================================
 */
(function () {
    "use strict";

    const STORAGE_KEY = "hello_solar_installer_notifications_store";
    const CHANNEL_NAME = "hello_solar_notifications_bus";
    const CURRENT_ROLE = "installer";

    // Installer Seed Events matching field operations lifecycle
    const DEFAULT_SEED = [
        {
            id: "notif-inst-001",
            recipientRole: "installer",
            recipientId: "*",
            eventType: "new_job_assigned",
            sourceEventId: "evt-job-2026-083-assign",
            recordId: "JOB-2026-083",
            title: "New Job Assigned: Ridgeview Villa",
            message: "10.8 kW Hybrid rooftop installation in Silang, Tagaytay City assigned to your crew.",
            timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            readAt: null,
            targetUrl: "myjob.html?job=JOB-2026-083",
            actionLabel: "View Job Roster"
        },
        {
            id: "notif-inst-002",
            recipientRole: "installer",
            recipientId: "*",
            eventType: "job_schedule_changed",
            sourceEventId: "evt-job-2026-081-resched",
            recordId: "JOB-2026-081",
            title: "Job Schedule Confirmed: Bautista Residence",
            message: "Homeowner confirmed morning site staging for Friday, Sept 18 at 8:30 AM.",
            timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
            readAt: null,
            targetUrl: "myjob.html?job=JOB-2026-081",
            actionLabel: "Check Site Access"
        },
        {
            id: "notif-inst-003",
            recipientRole: "installer",
            recipientId: "*",
            eventType: "job_requirements_updated",
            sourceEventId: "evt-job-2026-084-specs",
            recordId: "JOB-2026-084",
            title: "Requirements Updated: Makati Logistics Hub",
            message: "Single-line diagram updated with dual bi-directional CT sensor positions.",
            timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
            readAt: null,
            targetUrl: "myjob.html?job=JOB-2026-084",
            actionLabel: "Inspect SLD Specs"
        },
        {
            id: "notif-inst-004",
            recipientRole: "installer",
            recipientId: "*",
            eventType: "payout_status_updated",
            sourceEventId: "evt-pay-2026-101-cleared",
            recordId: "PAY-2026-101",
            title: "Payout Disbursed: ₱18,130 Released",
            message: "Milestone for Sy Residence (JOB-2026-085) credited to your registered BDO account.",
            timestamp: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
            readAt: new Date(Date.now() - 300 * 60 * 1000).toISOString(),
            targetUrl: "payout.html?payout=PAY-2026-101",
            actionLabel: "View Receipt"
        },
        {
            id: "notif-inst-005",
            recipientRole: "installer",
            recipientId: "*",
            eventType: "support_response_received",
            sourceEventId: "evt-sup-2026-042-reply",
            recordId: "SUP-2026-042",
            title: "Support Response: Dispatch Coordinator",
            message: "Engr. Mark Villanueva approved the conduit attic routing request for Batasan Hills.",
            timestamp: new Date(Date.now() - 540 * 60 * 1000).toISOString(),
            readAt: new Date(Date.now() - 480 * 60 * 1000).toISOString(),
            targetUrl: "support.html?reference=JOB-2026-081",
            actionLabel: "Read Message"
        }
    ];

    let currentFilter = "all";

    // --------------------------------------------------------------------------
    // STORAGE & PERSISTENCE
    // --------------------------------------------------------------------------
    function loadStoredNotifications() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn("Error loading notifications from storage:", e);
        }
        saveNotifications(DEFAULT_SEED);
        return DEFAULT_SEED;
    }

    function saveNotifications(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn("Error saving notifications to storage:", e);
        }
    }

    // --------------------------------------------------------------------------
    // BROADCAST CHANNEL & CROSS-TAB SYNC
    // --------------------------------------------------------------------------
    let broadcastChannel = null;
    try {
        if (typeof window.BroadcastChannel !== "undefined") {
            broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        }
    } catch (e) {
        console.warn("BroadcastChannel not supported, using storage fallback.");
    }

    function broadcastEvent(type, payload) {
        if (broadcastChannel) {
            broadcastChannel.postMessage({ type, payload });
        } else {
            try {
                localStorage.setItem("hello_solar_notif_sync_trigger", JSON.stringify({ type, payload, time: Date.now() }));
            } catch (e) {}
        }
    }

    // --------------------------------------------------------------------------
    // NOTIFICATION CORE SERVICE
    // --------------------------------------------------------------------------
    const NotificationService = {
        getRoleNotifications(role = CURRENT_ROLE) {
            const all = loadStoredNotifications();
            return all.filter((n) => n.recipientRole === role || n.recipientRole === "*");
        },

        getUnreadCount(role = CURRENT_ROLE) {
            const notifs = this.getRoleNotifications(role);
            return notifs.filter((n) => !n.readAt).length;
        },

        markAsRead(ids) {
            if (!ids || ids.length === 0) return;
            const all = loadStoredNotifications();
            const now = new Date().toISOString();
            let changed = false;

            all.forEach((n) => {
                if (ids.includes(n.id) && !n.readAt) {
                    n.readAt = now;
                    changed = true;
                }
            });

            if (changed) {
                saveNotifications(all);
                broadcastEvent("NOTIFICATIONS_READ", { ids, readAt: now });
            }
        },

        markAllAsRead(role = CURRENT_ROLE) {
            const all = loadStoredNotifications();
            const now = new Date().toISOString();
            let changed = false;

            all.forEach((n) => {
                if ((n.recipientRole === role || n.recipientRole === "*") && !n.readAt) {
                    n.readAt = now;
                    changed = true;
                }
            });

            if (changed) {
                saveNotifications(all);
                broadcastEvent("NOTIFICATIONS_ALL_READ", { role, readAt: now });
            }
        },

        dispatch(notifData) {
            const all = loadStoredNotifications();

            // Prevent duplicate event ingestion
            if (notifData.sourceEventId && all.some((n) => n.sourceEventId === notifData.sourceEventId)) {
                return;
            }

            const newNotif = {
                id: notifData.id || `notif-inst-${Date.now()}`,
                recipientRole: notifData.recipientRole || CURRENT_ROLE,
                recipientId: notifData.recipientId || "*",
                eventType: notifData.eventType || "general",
                sourceEventId: notifData.sourceEventId || `evt-${Date.now()}`,
                recordId: notifData.recordId || null,
                title: notifData.title || "Installer Operational Update",
                message: notifData.message || "",
                timestamp: notifData.timestamp || new Date().toISOString(),
                readAt: null,
                targetUrl: notifData.targetUrl || "myjob.html",
                actionLabel: notifData.actionLabel || "View Details"
            };

            all.unshift(newNotif);
            saveNotifications(all);
            broadcastEvent("NEW_NOTIFICATION", { notification: newNotif });
            showLiveToast(newNotif);
            updateBadge();
            renderNotificationList();
        }
    };

    // --------------------------------------------------------------------------
    // UI HELPERS & RENDERING
    // --------------------------------------------------------------------------
    function formatTimeAgo(isoString) {
        if (!isoString) return "";
        const diffSecs = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
        if (diffSecs < 60) return "Just now";
        const diffMins = Math.floor(diffSecs / 60);
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    }

    function getEventIcon(eventType) {
        switch (eventType) {
            case "new_job_assigned":
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
            case "job_schedule_changed":
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
            case "job_requirements_updated":
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
            case "payout_status_updated":
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M6 15h4"/></svg>`;
            case "support_response_received":
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
            default:
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
        }
    }

    function updateBadge() {
        const badge = document.getElementById("notificationBadge");
        const chip = document.getElementById("notifUnreadChip");
        const count = NotificationService.getUnreadCount(CURRENT_ROLE);

        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? "99+" : count;
                badge.classList.remove("hidden");
            } else {
                badge.classList.add("hidden");
            }
        }

        if (chip) {
            if (count > 0) {
                chip.textContent = `${count} unread`;
                chip.style.display = "inline-flex";
            } else {
                chip.style.display = "none";
            }
        }
    }

    function renderNotificationList() {
        const listEl = document.getElementById("notificationList");
        if (!listEl) return;

        const all = NotificationService.getRoleNotifications(CURRENT_ROLE);
        const filtered = currentFilter === "unread" ? all.filter((n) => !n.readAt) : all;

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="notification-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <h4>All caught up!</h4>
                    <p>${currentFilter === "unread" ? "No unread alerts at this moment." : "You have no operational notifications."}</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = filtered
            .map((n) => {
                const isUnread = !n.readAt;
                const timeAgo = formatTimeAgo(n.timestamp);
                const iconSvg = getEventIcon(n.eventType);

                return `
                <div class="notification-item ${isUnread ? "unread" : "read"}" data-id="${n.id}" data-url="${n.targetUrl || "myjob.html"}">
                    <div class="notif-item-icon">
                        ${iconSvg}
                    </div>
                    <div class="notif-item-content">
                        <div class="notif-item-header">
                            <h4 class="notif-item-title">${escapeHtml(n.title)}</h4>
                            <span class="notif-item-time">${timeAgo}</span>
                        </div>
                        <p class="notif-item-msg">${escapeHtml(n.message)}</p>
                        <div class="notif-item-actions">
                            <span class="notif-action-link">${escapeHtml(n.actionLabel || "View Record")} →</span>
                            ${isUnread ? '<span class="unread-dot-inline" title="Unread">●</span>' : ""}
                        </div>
                    </div>
                </div>
            `;
            })
            .join("");

        // Bind click routing
        listEl.querySelectorAll(".notification-item").forEach((el) => {
            el.addEventListener("click", () => {
                const id = el.getAttribute("data-id");
                const targetUrl = el.getAttribute("data-url");
                NotificationService.markAsRead([id]);
                updateBadge();

                if (targetUrl) {
                    closePanel();
                    handleRecordNavigation(targetUrl);
                }
            });
        });
    }

    /**
     * Intelligent record routing: handles deep-links, opens modals directly if on same page
     */
    function handleRecordNavigation(targetUrl) {
        const currentPath = window.location.pathname.split("/").pop() || "myjob.html";
        const urlObj = new URL(targetUrl, window.location.href);
        const targetPage = urlObj.pathname.split("/").pop() || "myjob.html";

        if (currentPath === targetPage) {
            // We are already on the target page: trigger modal directly if parameter present
            const jobParam = urlObj.searchParams.get("job");
            const payoutParam = urlObj.searchParams.get("payout");

            if (jobParam && window.openInstallerJobModal) {
                window.openInstallerJobModal(jobParam);
                return;
            }
            if (payoutParam && window.openInstallerPayoutModal) {
                window.openInstallerPayoutModal(payoutParam);
                return;
            }
            window.location.search = urlObj.search;
        } else {
            // Navigate to page with search params
            window.location.href = targetUrl;
        }
    }

    function showLiveToast(notif) {
        let toastContainer = document.getElementById("notificationToastContainer");
        if (!toastContainer) {
            toastContainer = document.createElement("div");
            toastContainer.id = "notificationToastContainer";
            toastContainer.className = "notification-toast-container";
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement("div");
        toast.className = "notification-toast";
        toast.innerHTML = `
            <div class="notif-toast-icon">
                ${getEventIcon(notif.eventType)}
            </div>
            <div class="notif-toast-body">
                <div class="notif-toast-title">${escapeHtml(notif.title)}</div>
                <div class="notif-toast-msg">${escapeHtml(notif.message)}</div>
            </div>
            <button type="button" class="notif-toast-close" aria-label="Dismiss">&times;</button>
        `;

        toast.addEventListener("click", (e) => {
            if (e.target.classList.contains("notif-toast-close")) {
                toast.remove();
                return;
            }
            NotificationService.markAsRead([notif.id]);
            updateBadge();
            toast.remove();
            if (notif.targetUrl) {
                handleRecordNavigation(notif.targetUrl);
            }
        });

        toastContainer.appendChild(toast);
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 5000);
    }

    function escapeHtml(str) {
        return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function positionPanel() {
        const panel = document.getElementById("notificationPanel");
        const bellBtn = document.getElementById("notificationBellBtn");
        if (!panel || !bellBtn) return;

        if (window.innerWidth > 768) {
            const bellRect = bellBtn.getBoundingClientRect();
            panel.style.position = "fixed";
            panel.style.top = `${Math.round(bellRect.bottom + 8)}px`;
            const rightOffset = Math.max(16, Math.round(window.innerWidth - bellRect.right));
            panel.style.right = `${rightOffset}px`;
            panel.style.left = "auto";
            panel.style.bottom = "auto";
            panel.style.width = "400px";
        } else {
            panel.style.position = "";
            panel.style.top = "";
            panel.style.right = "";
            panel.style.left = "";
            panel.style.bottom = "";
            panel.style.width = "";
        }
    }

    function openPanel() {
        const panel = document.getElementById("notificationPanel");
        const backdrop = document.getElementById("notificationBackdrop");
        const bellBtn = document.getElementById("notificationBellBtn");
        if (!panel || !backdrop) return;

        positionPanel();
        panel.classList.add("open");
        backdrop.classList.add("open");
        document.body.classList.add("notification-panel-open");

        if (bellBtn) bellBtn.setAttribute("aria-expanded", "true");
        renderNotificationList();

        // Mark visible unread items as read upon opening
        const unreadIds = NotificationService.getRoleNotifications(CURRENT_ROLE)
            .filter((n) => !n.readAt)
            .map((n) => n.id);

        if (unreadIds.length > 0) {
            setTimeout(() => {
                NotificationService.markAsRead(unreadIds);
                updateBadge();
            }, 600);
        }
    }

    function closePanel() {
        const panel = document.getElementById("notificationPanel");
        const backdrop = document.getElementById("notificationBackdrop");
        const bellBtn = document.getElementById("notificationBellBtn");

        if (panel) panel.classList.remove("open");
        if (backdrop) backdrop.classList.remove("open");
        document.body.classList.remove("notification-panel-open");

        if (bellBtn) {
            bellBtn.setAttribute("aria-expanded", "false");
        }
    }

    // --------------------------------------------------------------------------
    // DOM INJECTION & INITIALIZATION
    // --------------------------------------------------------------------------
    function injectNotificationUI() {
        if (document.getElementById("notificationBellContainer")) return;

        const topbarRight = document.querySelector(".topbar-right");
        if (!topbarRight) return;

        const container = document.createElement("div");
        container.className = "notification-bell-container";
        container.id = "notificationBellContainer";
        container.innerHTML = `
            <button class="notification-bell-btn" id="notificationBellBtn" type="button" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span class="notification-badge hidden" id="notificationBadge">0</span>
            </button>
        `;

        const profile = topbarRight.querySelector(".profile");
        if (profile) {
            topbarRight.insertBefore(container, profile);
        } else {
            topbarRight.appendChild(container);
        }

        if (!document.getElementById("notificationPanel")) {
            const panel = document.createElement("div");
            panel.className = "notification-panel";
            panel.id = "notificationPanel";
            panel.setAttribute("role", "dialog");
            panel.setAttribute("aria-labelledby", "notifTitle");
            panel.setAttribute("aria-modal", "true");
            panel.innerHTML = `
                <div class="notification-panel-header">
                    <div class="notification-header-left">
                        <h3 class="notification-title" id="notifTitle">Notifications</h3>
                        <span class="notification-unread-chip" id="notifUnreadChip" style="display: none;">0 unread</span>
                    </div>
                    <button class="notification-mark-all-btn" id="notifMarkAllBtn" type="button">Mark all as read</button>
                </div>

                <div class="notification-filter-tabs">
                    <button class="notification-filter-tab active" data-tab="all" type="button">All Alerts</button>
                    <button class="notification-filter-tab" data-tab="unread" type="button">Unread</button>
                </div>

                <div class="notification-list" id="notificationList"></div>

                <div class="notification-panel-footer">
                    <div class="notification-footer-status">
                        <span class="notification-live-pill"><span class="dot"></span> Simulation Mode Active</span>
                        <button class="notification-simulator-toggle" id="simToggleBtn" type="button">Test Events</button>
                    </div>

                    <div class="notification-simulator-box" id="simulatorBox">
                        <div class="notification-simulator-title">Simulate Field Operational Event:</div>
                        <div class="notification-simulator-btns">
                            <button type="button" class="sim-btn" id="simNewJobBtn">+ New Job</button>
                            <button type="button" class="sim-btn" id="simReschedBtn">⏱ Schedule</button>
                            <button type="button" class="sim-btn" id="simPayoutBtn">₱ Payout</button>
                            <button type="button" class="sim-btn" id="simSupportBtn">💬 Support</button>
                        </div>
                        <div style="font-size: 11px; color: var(--gray-400); margin-top: 6px; line-height: 1.3;">
                            BroadcastChannel syncs events across open tabs. Production WebSocket integration pending.
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);
        }

        if (!document.getElementById("notificationBackdrop")) {
            const backdrop = document.createElement("div");
            backdrop.className = "notification-backdrop";
            backdrop.id = "notificationBackdrop";
            backdrop.setAttribute("aria-hidden", "true");
            document.body.appendChild(backdrop);
        }

        bindUIEvents();
        updateBadge();
    }

    function bindUIEvents() {
        const bellBtn = document.getElementById("notificationBellBtn");
        const backdrop = document.getElementById("notificationBackdrop");
        const markAllBtn = document.getElementById("notifMarkAllBtn");
        const simToggleBtn = document.getElementById("simToggleBtn");
        const simulatorBox = document.getElementById("simulatorBox");

        if (bellBtn) {
            bellBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const panel = document.getElementById("notificationPanel");
                if (panel && panel.classList.contains("open")) {
                    closePanel();
                } else {
                    openPanel();
                }
            });
        }

        if (backdrop) backdrop.addEventListener("click", closePanel);

        if (markAllBtn) {
            markAllBtn.addEventListener("click", () => {
                NotificationService.markAllAsRead(CURRENT_ROLE);
                renderNotificationList();
                updateBadge();
            });
        }

        const tabs = document.querySelectorAll(".notification-filter-tab");
        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                tabs.forEach((t) => t.classList.remove("active"));
                tab.classList.add("active");
                currentFilter = tab.dataset.tab;
                renderNotificationList();
            });
        });

        if (simToggleBtn && simulatorBox) {
            simToggleBtn.addEventListener("click", () => {
                simulatorBox.classList.toggle("open");
            });
        }

        // Simulator Event Triggers
        const simNewJob = document.getElementById("simNewJobBtn");
        if (simNewJob) {
            simNewJob.addEventListener("click", () => {
                NotificationService.dispatch({
                    eventType: "new_job_assigned",
                    sourceEventId: `sim-job-${Date.now()}`,
                    recordId: "JOB-2026-081",
                    title: "New Job Assigned: Makati Logistics",
                    message: "15.0 kW Commercial system ready for pre-installation staging.",
                    targetUrl: "myjob.html?job=JOB-2026-084",
                    actionLabel: "View Assignment"
                });
            });
        }

        const simResched = document.getElementById("simReschedBtn");
        if (simResched) {
            simResched.addEventListener("click", () => {
                NotificationService.dispatch({
                    eventType: "job_schedule_changed",
                    sourceEventId: `sim-sched-${Date.now()}`,
                    recordId: "JOB-2026-082",
                    title: "Schedule Updated: Pasig Auto Spares",
                    message: "Inverter mounting moved to 9:00 AM due to client warehouse inspection.",
                    targetUrl: "myjob.html?job=JOB-2026-082",
                    actionLabel: "Check Schedule"
                });
            });
        }

        const simPayout = document.getElementById("simPayoutBtn");
        if (simPayout) {
            simPayout.addEventListener("click", () => {
                NotificationService.dispatch({
                    eventType: "payout_status_updated",
                    sourceEventId: `sim-pay-${Date.now()}`,
                    recordId: "PAY-2026-102",
                    title: "Payout Disbursed: ₱25,480 Released",
                    message: "Agri-Solar milestone payout transferred to registered BDO account.",
                    targetUrl: "payout.html?payout=PAY-2026-102",
                    actionLabel: "View Ledger"
                });
            });
        }

        const simSupport = document.getElementById("simSupportBtn");
        if (simSupport) {
            simSupport.addEventListener("click", () => {
                NotificationService.dispatch({
                    eventType: "support_response_received",
                    sourceEventId: `sim-sup-${Date.now()}`,
                    recordId: "SUP-2026-089",
                    title: "Support Response: Permit Verification",
                    message: "Engineering office approved your PEZA electrical clearance copy.",
                    targetUrl: "support.html?reference=JOB-2026-083",
                    actionLabel: "View Response"
                });
            });
        }

        document.addEventListener("click", (e) => {
            const panel = document.getElementById("notificationPanel");
            const bell = document.getElementById("notificationBellContainer");
            if (panel && panel.classList.contains("open")) {
                if (bell && !bell.contains(e.target) && !panel.contains(e.target)) {
                    closePanel();
                }
            }
        });

        window.addEventListener("resize", () => {
            const panel = document.getElementById("notificationPanel");
            if (panel && panel.classList.contains("open")) {
                positionPanel();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                const panel = document.getElementById("notificationPanel");
                if (panel && panel.classList.contains("open")) {
                    closePanel();
                }
            }
        });
    }

    // Cross-tab synchronization
    if (broadcastChannel) {
        broadcastChannel.onmessage = (e) => {
            const { type, payload } = e.data || {};
            if (type === "NEW_NOTIFICATION") {
                const notif = payload.notification;
                if (notif && (notif.recipientRole === CURRENT_ROLE || notif.recipientRole === "*")) {
                    showLiveToast(notif);
                    updateBadge();
                    renderNotificationList();
                }
            } else if (type === "NOTIFICATIONS_READ" || type === "NOTIFICATIONS_ALL_READ") {
                updateBadge();
                renderNotificationList();
            }
        };
    } else {
        window.addEventListener("storage", (e) => {
            if (e.key === STORAGE_KEY || e.key === "hello_solar_notif_sync_trigger") {
                updateBadge();
                renderNotificationList();
            }
        });
    }

    window.HelloSolarNotifications = NotificationService;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectNotificationUI);
    } else {
        injectNotificationUI();
    }
})();
