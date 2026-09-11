/**
 * ==========================================================================
 * HELLO SOLAR INSTALLER DASHBOARD
 * Mobile drawer navigation, profile management, any-size avatar upload,
 * dynamic initials & instant topbar avatar synchronization
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // --------------------------------------------------------------------------
    // 1. MOBILE DRAWER NAVIGATION
    // --------------------------------------------------------------------------
    const sidebar = document.getElementById("sidebar");
    const menuBtn = document.getElementById("menu");
    const backdrop = document.getElementById("backdrop");

    if (sidebar && menuBtn && backdrop) {
        function openMenu() {
            sidebar.classList.add("open");
            backdrop.classList.add("open");
            document.body.classList.add("nav-open");
            menuBtn.setAttribute("aria-expanded", "true");
            backdrop.setAttribute("aria-hidden", "false");
        }

        function closeMenu() {
            sidebar.classList.remove("open");
            backdrop.classList.remove("open");
            document.body.classList.remove("nav-open");
            menuBtn.setAttribute("aria-expanded", "false");
            backdrop.setAttribute("aria-hidden", "true");
        }

        menuBtn.addEventListener("click", () => {
            const isOpen = sidebar.classList.contains("open");
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        backdrop.addEventListener("click", closeMenu);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && sidebar.classList.contains("open")) {
                closeMenu();
                menuBtn.focus();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 768 && sidebar.classList.contains("open")) {
                closeMenu();
            }
        });
    }

    // --------------------------------------------------------------------------
    // 2. LOGOUT HANDLER
    // --------------------------------------------------------------------------
    const logoutBtn = document.getElementById("logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("hello_solar_installer_logged_in");
            localStorage.removeItem("hello_solar_installer_user");
        });
    }

    // --------------------------------------------------------------------------
    // 3. PROFILE DATA & AVATAR HELPERS
    // --------------------------------------------------------------------------
    const DEFAULT_INSTALLER_PROFILE = {
        username: "installer@hellosolar.ph",
        email: "installer@hellosolar.ph",
        businessName: "SolarTech Manila Installers",
        fullName: "Engr. Alex Rivera",
        phone: "+63 917 555 0199",
        licenseNo: "PCAB Solar Contractor Lic. #2024-8841",
        prcNo: "PRC Reg. Electrical Engineer #0078421",
        coverageArea: "Metro Manila, Cavite, Laguna, Rizal, Batangas",
        specialization: "Rooftop Grid-Tie Systems, Hybrid Storage, Net-Metering Commissioning",
        bio: "Over 8 years of premier residential and commercial rooftop solar installations with full PCAB safety accreditation and zero-incident track record.",
        avatarUrl: "",
        completedJobs: 48,
        totalCapacityKwp: 288,
        rating: 4.95,
        payoutMethod: "BDO Unibank (On File)"
    };

    function getStoredProfile() {
        try {
            const raw = localStorage.getItem("hello_solar_installer_user");
            if (raw) {
                const parsed = JSON.parse(raw);
                return Object.assign({}, DEFAULT_INSTALLER_PROFILE, parsed);
            }
        } catch (e) {
            console.warn("Could not parse profile:", e);
        }
        return Object.assign({}, DEFAULT_INSTALLER_PROFILE);
    }

    function saveStoredProfile(profileObj) {
        try {
            const serialized = JSON.stringify(profileObj);
            localStorage.setItem("hello_solar_installer_user", serialized);
        } catch (e) {
            console.error("Could not save profile:", e);
        }
    }

    function computeInitials(name) {
        if (!name) return "SI";
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return "SI";
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function renderAvatar(el, profileObj) {
        if (!el) return;
        const name = profileObj.businessName || profileObj.fullName || profileObj.username || "SolarTech Installer";
        const initials = computeInitials(name);

        if (profileObj.avatarUrl && profileObj.avatarUrl.trim() !== "") {
            el.innerHTML = `<img class="profile-avatar-img" src="${profileObj.avatarUrl}" alt="${name}">`;
        } else {
            el.innerHTML = initials;
        }
    }

    // --------------------------------------------------------------------------
    // 4. ANY-SIZE CLIENT-SIDE IMAGE PROCESSOR & COMPRESSOR
    // Automatically downscales and center-crops ANY image file size (1MB to 50MB+)
    // to a high-definition 480x480 square JPEG data URL (~25-45KB).
    // --------------------------------------------------------------------------
    function processImageFile(file, callback, errorCallback) {
        if (!file) return;
        if (!file.type || !file.type.startsWith("image/")) {
            if (errorCallback) errorCallback("Please choose an image file (PNG, JPG, WebP, SVG).");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            if (file.type === "image/svg+xml") {
                callback(event.target.result);
                return;
            }

            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    const maxDim = 480;
                    const w = img.width;
                    const h = img.height;

                    const minSide = Math.min(w, h);
                    const sx = (w - minSide) / 2;
                    const sy = (h - minSide) / 2;

                    canvas.width = Math.min(minSide, maxDim);
                    canvas.height = Math.min(minSide, maxDim);

                    const ctx = canvas.getContext("2d");
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = "high";
                    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, canvas.width, canvas.height);

                    const compressed = canvas.toDataURL("image/jpeg", 0.88);
                    callback(compressed);
                } catch (err) {
                    console.warn("Canvas crop fallback:", err);
                    callback(event.target.result);
                }
            };
            img.onerror = () => {
                if (errorCallback) errorCallback("Could not decode image file.");
            };
            img.src = event.target.result;
        };
        reader.onerror = () => {
            if (errorCallback) errorCallback("Failed to read image file.");
        };
        reader.readAsDataURL(file);
    }

    // Realistic SVG Picture Presets
    const PRESET_PICTURES = {
        officer: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#0f172a"/><circle cx="60" cy="46" r="24" fill="#fed7aa"/><path d="M22 110c0-25 18-38 38-38s38 13 38 38" fill="#1e293b"/><path d="M48 72h24l-8 24h-8z" fill="#ff8a00"/><circle cx="88" cy="88" r="16" fill="#ff8a00"/><text x="88" y="93" font-size="14" font-weight="bold" text-anchor="middle" fill="#ffffff">👔</text></svg>`),
        engineer: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#1e293b"/><circle cx="60" cy="48" r="24" fill="#fde68a"/><path d="M22 110c0-25 18-38 38-38s38 13 38 38" fill="#ea580c"/><circle cx="88" cy="88" r="16" fill="#10b981"/><text x="88" y="93" font-size="14" font-weight="bold" text-anchor="middle" fill="#ffffff">👷</text></svg>`),
        pro: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#0c4a6e"/><circle cx="60" cy="46" r="24" fill="#fed7aa"/><path d="M22 110c0-25 18-38 38-38s38 13 38 38" fill="#0369a1"/><circle cx="88" cy="88" r="16" fill="#f59e0b"/><text x="88" y="93" font-size="14" font-weight="bold" text-anchor="middle" fill="#ffffff">⚡</text></svg>`),
        solar: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#18181b"/><circle cx="60" cy="40" r="18" fill="#facc15"/><g fill="#38bdf8"><polygon points="26,68 56,68 52,106 18,106"/><polygon points="64,68 94,68 102,106 70,106"/></g></svg>`),
        storage: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#064e3b"/><rect x="35" y="32" width="50" height="74" rx="8" fill="#10b981"/><rect x="48" y="24" width="24" height="8" rx="2" fill="#34d399"/><text x="60" y="74" font-size="28" font-weight="bold" text-anchor="middle" fill="#ffffff">⚡</text></svg>`)
    };

    function syncAllProfileDisplays() {
        const profile = getStoredProfile();
        const displayName = profile.businessName || profile.fullName || "SolarTech Installer";
        const initials = computeInitials(displayName);

        // 1. Topbar elements - IMMEDIATELY updates every topbar avatar with chosen picture!
        document.querySelectorAll(".profile-name").forEach(el => {
            el.textContent = displayName;
        });

        document.querySelectorAll(".profile-avatar").forEach(el => {
            renderAvatar(el, profile);
        });

        // 2. Profile page hero elements
        const heroNameEl = document.getElementById("heroProfileName");
        if (heroNameEl) heroNameEl.textContent = displayName;

        const heroSubEl = document.getElementById("heroProfileSub");
        if (heroSubEl) {
            heroSubEl.innerHTML = `
                <span>${profile.fullName || "Lead Contractor"}</span> · 
                <span>${profile.licenseNo || "Certified Solar Partner"}</span> · 
                <span class="installer-status-pill">Accreditation on File</span>
            `;
        }

        const heroAvatarEl = document.getElementById("heroProfileAvatar");
        if (heroAvatarEl) renderAvatar(heroAvatarEl, profile);

        // 3. Modal preview
        const avatarWrap = document.getElementById("modalAvatarWrap");
        if (avatarWrap) {
            renderAvatar(avatarWrap, profile);
        }

        // 4. Update Initials buttons
        document.querySelectorAll(".avatar-preset-btn.initials-btn").forEach(el => {
            el.textContent = initials;
            el.classList.toggle("active", !profile.avatarUrl || profile.avatarUrl.trim() === "");
        });

        // 5. Update active preset button highlight
        document.querySelectorAll(".avatar-preset-btn:not(.initials-btn)").forEach(btn => {
            const key = btn.getAttribute("data-preset");
            const isMatch = profile.avatarUrl && PRESET_PICTURES[key] && profile.avatarUrl === PRESET_PICTURES[key];
            btn.classList.toggle("active", Boolean(isMatch));
        });

        // 6. Stats elements
        const statJobs = document.getElementById("statCompletedJobs");
        if (statJobs) statJobs.textContent = `${profile.completedJobs || 48} Projects`;

        const statCap = document.getElementById("statInstalledCapacity");
        if (statCap) statCap.textContent = `${profile.totalCapacityKwp || 288} kWp`;

        const statRate = document.getElementById("statCustomerRating");
        if (statRate) statRate.textContent = `${profile.rating || 4.95} ★`;

        const payoutEl = document.getElementById("sidebarPayoutMethod");
        if (payoutEl) payoutEl.textContent = profile.payoutMethod || "BDO Unibank (Verified)";

        // 7. Form fields on profile.html (only sync if not currently being typed in)
        const formFields = [
            { id: "pageBusinessName", val: profile.businessName },
            { id: "pageFullName", val: profile.fullName },
            { id: "pageEmail", val: profile.email },
            { id: "pagePhone", val: profile.phone },
            { id: "pageLicenseNo", val: profile.licenseNo },
            { id: "pagePrcNo", val: profile.prcNo },
            { id: "pageCoverageArea", val: profile.coverageArea },
            { id: "pageSpecialization", val: profile.specialization },
            { id: "pageBio", val: profile.bio }
        ];

        formFields.forEach(item => {
            const input = document.getElementById(item.id);
            if (input && document.activeElement !== input) {
                input.value = item.val || "";
            }
        });
    }

    // Initial render
    syncAllProfileDisplays();

    // --------------------------------------------------------------------------
    // 5. INTERACTIVE PROFILE MODAL & PICTURE UPLOAD
    // --------------------------------------------------------------------------
    let modalBackdrop = document.getElementById("profileModal");

    if (!modalBackdrop) {
        modalBackdrop = document.createElement("div");
        modalBackdrop.id = "profileModal";
        modalBackdrop.className = "profile-modal-backdrop";
        modalBackdrop.setAttribute("role", "dialog");
        modalBackdrop.setAttribute("aria-modal", "true");
        modalBackdrop.setAttribute("aria-labelledby", "profileModalTitle");

        modalBackdrop.innerHTML = `
            <div class="profile-modal-card">
                <!-- Modal Header -->
                <div class="profile-modal-header">
                    <div class="profile-modal-header-info">
                        <div class="profile-modal-badge">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div>
                            <h3 class="profile-modal-title" id="profileModalTitle">Installer Profile</h3>
                            <p class="profile-modal-subtitle">Manage company details, choose avatar picture, and contractor credentials.</p>
                        </div>
                    </div>
                    <button type="button" class="profile-modal-close" id="closeProfileModal" aria-label="Close modal">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <!-- Modal Body -->
                <div class="profile-modal-body">
                    <!-- Avatar Photo & Upload Section -->
                    <div class="profile-avatar-section">
                        <div class="profile-modal-avatar-wrap" id="modalAvatarWrap" title="Click to upload profile photo">
                            <span id="modalAvatarInitials">SI</span>
                            <div class="profile-avatar-overlay">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                </svg>
                            </div>
                        </div>

                        <div class="profile-avatar-controls">
                            <div class="profile-avatar-title">Profile Picture & Avatar</div>
                            <div class="profile-avatar-desc">Choose an avatar picture (or upload any photo size). Chosen picture shows in the topbar immediately.</div>
                            
                            <div class="profile-avatar-actions">
                                <label class="btn-upload-avatar" title="Upload any size image file">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    Upload Picture (Any Size)
                                    <input type="file" id="avatarFileInput" accept="image/*" style="display: none;">
                                </label>
                                <button type="button" class="btn-remove-avatar" id="btnRemoveAvatar">Use Initials</button>
                            </div>

                            <!-- Quick Preset Photo Picker Gallery -->
                            <div class="avatar-presets-wrap">
                                <div class="avatar-presets-label">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                    Choose Photo or Initials:
                                </div>
                                <div class="avatar-presets-grid" id="modalPresetsGrid">
                                    <button type="button" class="avatar-preset-btn" data-preset="officer" title="Finance & Solar Officer">
                                        <img src="${PRESET_PICTURES.officer}" alt="Officer">
                                    </button>
                                    <button type="button" class="avatar-preset-btn" data-preset="engineer" title="Solar Field Engineer">
                                        <img src="${PRESET_PICTURES.engineer}" alt="Engineer">
                                    </button>
                                    <button type="button" class="avatar-preset-btn" data-preset="pro" title="Master Electrician">
                                        <img src="${PRESET_PICTURES.pro}" alt="Specialist">
                                    </button>
                                    <button type="button" class="avatar-preset-btn" data-preset="solar" title="Solar PV Array">
                                        <img src="${PRESET_PICTURES.solar}" alt="Solar Array">
                                    </button>
                                    <button type="button" class="avatar-preset-btn" data-preset="storage" title="Battery Storage">
                                        <img src="${PRESET_PICTURES.storage}" alt="Storage">
                                    </button>
                                    <button type="button" class="avatar-preset-btn initials-btn" data-preset="initials" title="Use Name Initials">
                                        SI
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Project Performance Badges -->
                    <div class="installer-project-info">
                        <div class="installer-info-item">
                            <span class="installer-info-label">Network Status</span>
                            <span class="installer-status-pill">● Certified Active</span>
                        </div>
                        <div class="installer-info-item">
                            <span class="installer-info-label">Accreditation</span>
                            <span class="installer-info-val">Hello Solar Tier 1</span>
                        </div>
                        <div class="installer-info-item">
                            <span class="installer-info-label">Installed Capacity</span>
                            <span class="installer-info-val" id="modalCapacityStat">288 kWp Rooftop Solar</span>
                        </div>
                        <div class="installer-info-item">
                            <span class="installer-info-label">Completed Jobs</span>
                            <span class="installer-info-val" id="modalJobsStat">48 Projects Verified</span>
                        </div>
                    </div>

                    <!-- Editable Form Fields -->
                    <form id="modalProfileForm" class="profile-form-grid">
                        <div class="profile-field">
                            <label for="modalBusinessName">Company / Business Name</label>
                            <input type="text" id="modalBusinessName" required>
                        </div>

                        <div class="profile-field">
                            <label for="modalFullName">Lead Contractor / Full Name</label>
                            <input type="text" id="modalFullName" required>
                        </div>

                        <div class="profile-field">
                            <label for="modalEmail">Work Email Address</label>
                            <input type="email" id="modalEmail" required>
                        </div>

                        <div class="profile-field">
                            <label for="modalPhone">Mobile / Dispatch Contact</label>
                            <input type="tel" id="modalPhone" required>
                        </div>

                        <div class="profile-field">
                            <label for="modalLicenseNo">PCAB / Electrical License #</label>
                            <input type="text" id="modalLicenseNo">
                        </div>

                        <div class="profile-field">
                            <label for="modalCoverageArea">Operating Coverage Regions</label>
                            <input type="text" id="modalCoverageArea">
                        </div>
                    </form>
                </div>

                <!-- Modal Footer -->
                <div class="profile-modal-footer">
                    <button type="button" class="btn-modal-cancel" id="cancelProfileModal">Cancel</button>
                    <button type="button" class="btn-modal-save" id="saveProfileModal">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Save Changes
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modalBackdrop);
    }

    // Modal elements
    const closeBtn = document.getElementById("closeProfileModal");
    const cancelBtn = document.getElementById("cancelProfileModal");
    const saveBtn = document.getElementById("saveProfileModal");
    const avatarInput = document.getElementById("avatarFileInput");
    const avatarWrap = document.getElementById("modalAvatarWrap");
    const removeAvatarBtn = document.getElementById("btnRemoveAvatar");

    const modalBusinessName = document.getElementById("modalBusinessName");
    const modalFullName = document.getElementById("modalFullName");
    const modalEmail = document.getElementById("modalEmail");
    const modalPhone = document.getElementById("modalPhone");
    const modalLicenseNo = document.getElementById("modalLicenseNo");
    const modalCoverageArea = document.getElementById("modalCoverageArea");

    let currentAvatarDataUrl = "";

    function openProfileModal() {
        const profile = getStoredProfile();
        currentAvatarDataUrl = profile.avatarUrl || "";

        if (modalBusinessName) modalBusinessName.value = profile.businessName || "";
        if (modalFullName) modalFullName.value = profile.fullName || "";
        if (modalEmail) modalEmail.value = profile.email || "";
        if (modalPhone) modalPhone.value = profile.phone || "";
        if (modalLicenseNo) modalLicenseNo.value = profile.licenseNo || "";
        if (modalCoverageArea) modalCoverageArea.value = profile.coverageArea || "";

        syncAllProfileDisplays();
        modalBackdrop.classList.add("open");
    }

    function closeProfileModal() {
        modalBackdrop.classList.remove("open");
    }

    function updateModalAvatarPreview() {
        const tempObj = {
            businessName: modalBusinessName ? modalBusinessName.value : "",
            fullName: modalFullName ? modalFullName.value : "",
            avatarUrl: currentAvatarDataUrl
        };
        renderAvatar(avatarWrap, tempObj);
    }

    // Trigger opening modal when clicking topbar .profile or links
    document.querySelectorAll(".profile").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            openProfileModal();
        });
    });

    if (closeBtn) closeBtn.addEventListener("click", closeProfileModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeProfileModal);

    modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) closeProfileModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalBackdrop.classList.contains("open")) {
            closeProfileModal();
        }
    });

    // Real-time initials update as user types in modal
    if (modalBusinessName) modalBusinessName.addEventListener("input", updateModalAvatarPreview);
    if (modalFullName) modalFullName.addEventListener("input", updateModalAvatarPreview);

    // Any-size Avatar upload from user file in modal - IMMEDIATELY updates topbar circle!
    if (avatarInput) {
        avatarInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            processImageFile(file, (optimizedDataUrl) => {
                currentAvatarDataUrl = optimizedDataUrl;
                const profile = getStoredProfile();
                profile.avatarUrl = optimizedDataUrl;
                saveStoredProfile(profile);
                syncAllProfileDisplays();
                showProfileToast("Profile picture updated! Showing in topbar ✓");
                window.dispatchEvent(new CustomEvent("helloSolarProfileUpdated", { detail: profile }));
            }, (errMsg) => {
                showProfileToast(errMsg);
            });
        });
    }

    if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener("click", () => {
            avatarInput.click();
        });
    }

    // Revert to initials in modal - IMMEDIATELY updates topbar circle!
    if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener("click", () => {
            currentAvatarDataUrl = "";
            const profile = getStoredProfile();
            profile.avatarUrl = "";
            saveStoredProfile(profile);
            if (avatarInput) avatarInput.value = "";
            syncAllProfileDisplays();
            showProfileToast("Reverted to your dynamic name initials! ✓");
            window.dispatchEvent(new CustomEvent("helloSolarProfileUpdated", { detail: profile }));
        });
    }

    // Save Profile Changes from Modal
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            const profile = getStoredProfile();

            profile.businessName = modalBusinessName ? modalBusinessName.value.trim() : profile.businessName;
            profile.fullName = modalFullName ? modalFullName.value.trim() : profile.fullName;
            profile.email = modalEmail ? modalEmail.value.trim() : profile.email;
            profile.phone = modalPhone ? modalPhone.value.trim() : profile.phone;
            profile.licenseNo = modalLicenseNo ? modalLicenseNo.value.trim() : profile.licenseNo;
            profile.coverageArea = modalCoverageArea ? modalCoverageArea.value.trim() : profile.coverageArea;
            if (currentAvatarDataUrl !== undefined) {
                profile.avatarUrl = currentAvatarDataUrl;
            }

            saveStoredProfile(profile);
            syncAllProfileDisplays();
            closeProfileModal();
            showProfileToast("Installer profile & picture saved successfully! ✓");

            window.dispatchEvent(new CustomEvent("helloSolarProfileUpdated", { detail: profile }));
        });
    }

    // --------------------------------------------------------------------------
    // 6. DEDICATED PROFILE PAGE (profile.html) DYNAMIC INITIALS & PICTURE PICKER
    // --------------------------------------------------------------------------
    const pageBusinessName = document.getElementById("pageBusinessName");
    const pageFullName = document.getElementById("pageFullName");
    const pageEmail = document.getElementById("pageEmail");
    const pagePhone = document.getElementById("pagePhone");
    const pageLicenseNo = document.getElementById("pageLicenseNo");
    const pagePrcNo = document.getElementById("pagePrcNo");
    const pageCoverageArea = document.getElementById("pageCoverageArea");
    const pageSpecialization = document.getElementById("pageSpecialization");
    const pageBio = document.getElementById("pageBio");

    const heroAvatarEl = document.getElementById("heroProfileAvatar");
    const pageAvatarInput = document.getElementById("pageAvatarFileInput");
    const btnPageRemoveAvatar = document.getElementById("btnPageRemoveAvatar");
    const btnSavePageProfile = document.getElementById("btnSavePageProfile");

    // Real-time initials update as user types business or contractor name
    function handlePageNameInput() {
        const currentProfile = getStoredProfile();
        const liveName = (pageBusinessName && pageBusinessName.value.trim()) ||
                         (pageFullName && pageFullName.value.trim()) ||
                         "SolarTech Installer";

        // Update hero title in real time
        const heroNameEl = document.getElementById("heroProfileName");
        if (heroNameEl) heroNameEl.textContent = liveName;

        // If no custom picture is set, dynamically update initials on hero & topbar!
        if (!currentProfile.avatarUrl || currentProfile.avatarUrl.trim() === "") {
            const initials = computeInitials(liveName);
            if (heroAvatarEl) heroAvatarEl.textContent = initials;
            document.querySelectorAll(".profile-avatar").forEach(el => {
                el.textContent = initials;
            });
            document.querySelectorAll(".avatar-preset-btn.initials-btn").forEach(el => {
                el.textContent = initials;
            });
        }
    }

    if (pageBusinessName) pageBusinessName.addEventListener("input", handlePageNameInput);
    if (pageFullName) pageFullName.addEventListener("input", handlePageNameInput);

    // Click hero avatar directly to trigger file picker
    if (heroAvatarEl && pageAvatarInput) {
        heroAvatarEl.addEventListener("click", () => {
            pageAvatarInput.click();
        });
    }

    // Any-size image file upload on dedicated profile page - IMMEDIATELY updates topbar!
    if (pageAvatarInput) {
        pageAvatarInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            processImageFile(file, (optimizedDataUrl) => {
                const profile = getStoredProfile();
                profile.avatarUrl = optimizedDataUrl;
                saveStoredProfile(profile);
                currentAvatarDataUrl = optimizedDataUrl;
                syncAllProfileDisplays();
                showProfileToast("Profile picture updated! Displayed in topbar ✓");

                window.dispatchEvent(new CustomEvent("helloSolarProfileUpdated", { detail: profile }));
            }, (errMsg) => {
                showProfileToast(errMsg);
            });
        });
    }

    // Preset Pictures: Clicking ANY preset button immediately changes the topbar avatar to that picture!
    document.addEventListener("click", (e) => {
        const presetBtn = e.target.closest(".avatar-preset-btn");
        if (!presetBtn) return;
        e.preventDefault();

        const presetKey = presetBtn.getAttribute("data-preset");

        // If user clicked the Initials button:
        if (presetBtn.classList.contains("initials-btn") || presetKey === "initials") {
            const profile = getStoredProfile();
            profile.avatarUrl = "";
            currentAvatarDataUrl = "";
            saveStoredProfile(profile);
            syncAllProfileDisplays();
            showProfileToast("Switched to your dynamic name initials in topbar! ✓");
            window.dispatchEvent(new CustomEvent("helloSolarProfileUpdated", { detail: profile }));
            return;
        }

        // If user clicked a Picture Preset:
        const dataUrl = PRESET_PICTURES[presetKey];
        if (dataUrl) {
            currentAvatarDataUrl = dataUrl;
            const profile = getStoredProfile();
            profile.avatarUrl = dataUrl;
            saveStoredProfile(profile);
            syncAllProfileDisplays();
            showProfileToast("Chosen picture now displayed in topbar! ✓");
            window.dispatchEvent(new CustomEvent("helloSolarProfileUpdated", { detail: profile }));
        }
    });

    // Revert to initials button on profile page
    if (btnPageRemoveAvatar) {
        btnPageRemoveAvatar.addEventListener("click", () => {
            const profile = getStoredProfile();
            profile.avatarUrl = "";
            saveStoredProfile(profile);
            currentAvatarDataUrl = "";
            if (pageAvatarInput) pageAvatarInput.value = "";

            syncAllProfileDisplays();
            showProfileToast("Picture removed. Now showing dynamic initials in topbar! ✓");

            window.dispatchEvent(new CustomEvent("helloSolarProfileUpdated", { detail: profile }));
        });
    }

    // Save Profile Changes from dedicated profile page
    if (btnSavePageProfile) {
        btnSavePageProfile.addEventListener("click", (e) => {
            e.preventDefault();
            const profile = getStoredProfile();

            if (pageBusinessName && pageBusinessName.value.trim()) {
                profile.businessName = pageBusinessName.value.trim();
            }
            if (pageFullName && pageFullName.value.trim()) {
                profile.fullName = pageFullName.value.trim();
            }
            if (pageEmail && pageEmail.value.trim()) {
                profile.email = pageEmail.value.trim();
            }
            if (pagePhone && pagePhone.value.trim()) {
                profile.phone = pagePhone.value.trim();
            }
            if (pageLicenseNo) profile.licenseNo = pageLicenseNo.value.trim();
            if (pagePrcNo) profile.prcNo = pagePrcNo.value.trim();
            if (pageCoverageArea) profile.coverageArea = pageCoverageArea.value.trim();
            if (pageSpecialization) profile.specialization = pageSpecialization.value.trim();
            if (pageBio) profile.bio = pageBio.value.trim();

            saveStoredProfile(profile);
            syncAllProfileDisplays();
            showProfileToast("Installer profile & credentials saved successfully! ✓");

            window.dispatchEvent(new CustomEvent("helloSolarProfileUpdated", { detail: profile }));
        });
    }

    // Cross-tab and global synchronization
    window.addEventListener("helloSolarProfileUpdated", () => {
        syncAllProfileDisplays();
    });

    window.addEventListener("storage", (e) => {
        if (e.key && e.key.includes("hello_solar")) {
            syncAllProfileDisplays();
        }
    });

    // --------------------------------------------------------------------------
    // 7. TOAST NOTIFICATION HELPER
    // --------------------------------------------------------------------------
    function showProfileToast(message) {
        let toastEl = document.getElementById("profileToast");
        if (!toastEl) {
            toastEl = document.createElement("div");
            toastEl.id = "profileToast";
            toastEl.className = "profile-toast";
            document.body.appendChild(toastEl);
        }

        toastEl.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${message}</span>
        `;

        toastEl.classList.add("show");
        clearTimeout(window._profileToastTimer);
        window._profileToastTimer = setTimeout(() => {
            toastEl.classList.remove("show");
        }, 3500);
    }

    // Export helpers to window
    window.HelloSolarProfile = {
        getProfile: getStoredProfile,
        saveProfile: saveStoredProfile,
        syncDisplays: syncAllProfileDisplays,
        openModal: openProfileModal,
        closeModal: closeProfileModal,
        showToast: showProfileToast,
        computeInitials: computeInitials,
        processImageFile: processImageFile
    };

    // Auto-highlight active navigation item in bottom nav
    const activePath = window.location.pathname.split("/").pop() || "myjob.html";
    document.querySelectorAll(".mobile-bottom-nav-item").forEach(item => {
        const href = item.getAttribute("href");
        if (href && href.includes(activePath)) {
            item.classList.add("active");
            item.setAttribute("aria-current", "page");
        } else {
            item.classList.remove("active");
            item.removeAttribute("aria-current");
        }
    });
});
