/**
 * ==========================================================================
 * HELLO SOLAR INSTALLER — AUTH SCRIPT
 * Client-side authentication using localStorage & JSON accounts
 * Supports Login, Signup, Password Strength Meter, & Visibility Toggle
 * ==========================================================================
 */

const DEFAULT_INSTALLER_ACCOUNTS = [
    {
        username: "installer@hellosolar.ph",
        email: "installer@hellosolar.ph",
        password: "password123",
        businessName: "SolarTech Installer",
        fullName: "Alex Rivera",
        phone: "+63 917 555 0199"
    },
    {
        username: "installer",
        email: "installer@hellosolar.ph",
        password: "password123",
        businessName: "SolarTech Installer",
        fullName: "Alex Rivera",
        phone: "+63 917 555 0199"
    }
];

const STORAGE_KEY = "hello_solar_installer_accounts";
const SESSION_KEY = "hello_solar_installer_logged_in";
const USER_KEY = "hello_solar_installer_user";


// --------------------------------------------------------------------------
// 1. ACCOUNT STORAGE HELPERS
// --------------------------------------------------------------------------
function getAccounts() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Merge with defaults ensuring no duplicate emails
                const emails = new Set(parsed.map(a => (a.email || "").toLowerCase()));
                const missingDefaults = DEFAULT_INSTALLER_ACCOUNTS.filter(d => !emails.has(d.email.toLowerCase()));
                return [...parsed, ...missingDefaults];
            }
        }
    } catch (err) {
        console.warn("Error reading stored installer accounts:", err);
    }
    return [...DEFAULT_INSTALLER_ACCOUNTS];
}

function saveNewAccount(newAccount) {
    try {
        const accounts = getAccounts();
        accounts.push(newAccount);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
        return true;
    } catch (err) {
        console.error("Error saving account:", err);
        return false;
    }
}

// --------------------------------------------------------------------------
// 2. AUTHENTICATION & SESSION
// --------------------------------------------------------------------------
function authenticate(identifier, password) {
    const accounts = getAccounts();
    const cleanId = (identifier || "").trim().toLowerCase();
    const cleanPass = password || "";

    return accounts.find(acc => {
        const matchUser = acc.username && acc.username.toLowerCase() === cleanId;
        const matchEmail = acc.email && acc.email.toLowerCase() === cleanId;
        const matchPass = acc.password === cleanPass;
        return (matchUser || matchEmail) && matchPass;
    }) || null;
}

function setSession(account) {
    const userData = {
        username: account.username || account.email,
        email: account.email,
        businessName: account.businessName || "SolarTech Installer",
        fullName: account.fullName || "Installer Partner",
        phone: account.phone || "",
        avatarUrl: account.avatarUrl || ""
    };

    localStorage.setItem(SESSION_KEY, "true");
    localStorage.setItem(USER_KEY, JSON.stringify(userData));

}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
}

// Expose globally as window.HelloSolarAuth for template compatibility
window.HelloSolarAuth = {
    authenticate: authenticate,
    setSession: setSession,
    clearSession: clearSession,
    getAccounts: getAccounts,
    saveNewAccount: saveNewAccount
};

// --------------------------------------------------------------------------
// 3. PASSWORD VISIBILITY TOGGLE & STRENGTH METER
// --------------------------------------------------------------------------
function initPasswordFeatures() {
    // Show/Hide Password Toggle
    const toggleButtons = document.querySelectorAll(".password-toggle-btn");
    toggleButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const wrap = btn.closest(".password-wrap");
            if (!wrap) return;
            const input = wrap.querySelector("input");
            if (!input) return;

            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
            btn.setAttribute("aria-pressed", isPassword ? "true" : "false");

            const eyeIcon = btn.querySelector("svg");
            if (eyeIcon) {
                if (isPassword) {
                    // Slashed eye (hide)
                    eyeIcon.innerHTML = `
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                        <line x1="2" y1="2" x2="22" y2="22"/>
                    `;
                } else {
                    // Open eye
                    eyeIcon.innerHTML = `
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                        <circle cx="12" cy="12" r="3"/>
                    `;
                }
            }
        });
    });

    // Password Strength Meter & Confirm Match
    const signupPassInput = document.getElementById("signup-password");
    const confirmPassInput = document.getElementById("signup-confirm-password");
    const strengthWrap = document.getElementById("strength-meter");
    const meterLine = document.getElementById("meter-line");
    const strengthText = document.getElementById("strength-text");
    const matchBadge = document.getElementById("match-badge");
    const segments = [
        document.getElementById("seg1"),
        document.getElementById("seg2"),
        document.getElementById("seg3"),
        document.getElementById("seg4")
    ];

    function checkMatch() {
        if (!signupPassInput || !confirmPassInput || !matchBadge) return;
        const pass = signupPassInput.value;
        const conf = confirmPassInput.value;
        if (conf && pass === conf) {
            matchBadge.classList.add("visible");
        } else {
            matchBadge.classList.remove("visible");
        }
    }

    if (signupPassInput) {
        signupPassInput.addEventListener("input", () => {
            const val = signupPassInput.value;
            if (!val) {
                if (strengthWrap) strengthWrap.classList.remove("active");
                if (meterLine) meterLine.style.width = "0%";
                if (matchBadge) matchBadge.classList.remove("visible");
                return;
            }

            if (strengthWrap) strengthWrap.classList.add("active");

            let score = 0;
            if (val.length >= 6) score++;
            if (val.length >= 9) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val) || /[A-Z]/.test(val)) score++;

            if (score === 0 && val.length > 0) score = 1;

            const colors = {
                1: "#ef4444", // Weak (red)
                2: "#f59e0b", // Fair (amber)
                3: "#3b82f6", // Good (blue)
                4: "#10b981"  // Strong (green)
            };

            const labels = {
                1: "Weak",
                2: "Fair",
                3: "Good",
                4: "Strong"
            };

            const widths = {
                1: "25%",
                2: "50%",
                3: "75%",
                4: "100%"
            };

            segments.forEach((seg, idx) => {
                if (seg) {
                    seg.style.background = idx < score ? colors[score] : "#e2e8f0";
                }
            });

            if (meterLine) {
                meterLine.style.width = widths[score] || "25%";
                meterLine.style.background = colors[score] || "#ef4444";
            }

            if (strengthText) {
                strengthText.textContent = labels[score] || "Weak";
                strengthText.style.color = colors[score] || "#64748b";
            }

            checkMatch();
        });
    }

    if (confirmPassInput) {
        confirmPassInput.addEventListener("input", checkMatch);
    }
}

// --------------------------------------------------------------------------
// 4. FORM EVENT HANDLERS
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    initPasswordFeatures();

    // --- LOGIN FORM ---
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        const userInput = document.getElementById("login-email");
        const passInput = document.getElementById("login-password");
        const errorBox = document.getElementById("error-msg");

        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const identifier = userInput ? userInput.value.trim() : "";
            const password = passInput ? passInput.value : "";

            if (!identifier || !password) {
                if (errorBox) {
                    errorBox.textContent = "Please enter both email/username and password.";
                    errorBox.style.display = "block";
                }
                return;
            }

            const matched = authenticate(identifier, password);
            if (matched) {
                if (errorBox) errorBox.style.display = "none";
                setSession(matched);
                window.location.href = "myjob.html";
            } else {
                if (errorBox) {
                    errorBox.textContent = "Invalid email/username or password. Please try again.";
                    errorBox.style.display = "block";
                }
            }
        });
    }

    // --- SIGN UP FORM ---
    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
        const businessNameInput = document.getElementById("business-name");
        const fullNameInput = document.getElementById("full-name");
        const emailInput = document.getElementById("signup-email");
        const phoneInput = document.getElementById("signup-phone");
        const passInput = document.getElementById("signup-password");
        const confirmPassInput = document.getElementById("signup-confirm-password");
        const termsCheck = document.getElementById("terms-checkbox");
        const errorBox = document.getElementById("error-msg");

        signupForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const businessName = businessNameInput ? businessNameInput.value.trim() : "";
            const fullName = fullNameInput ? fullNameInput.value.trim() : "";
            const email = emailInput ? emailInput.value.trim() : "";
            const phone = phoneInput ? phoneInput.value.trim() : "";
            const password = passInput ? passInput.value : "";
            const confirmPassword = confirmPassInput ? confirmPassInput.value : "";

            if (!email || !password) {
                if (errorBox) {
                    errorBox.textContent = "Please fill in all required fields.";
                    errorBox.style.display = "block";
                }
                return;
            }

            if (password !== confirmPassword) {
                if (errorBox) {
                    errorBox.textContent = "Passwords do not match. Please re-enter.";
                    errorBox.style.display = "block";
                }
                return;
            }

            if (password.length < 6) {
                if (errorBox) {
                    errorBox.textContent = "Password must be at least 6 characters long.";
                    errorBox.style.display = "block";
                }
                return;
            }

            if (termsCheck && !termsCheck.checked) {
                if (errorBox) {
                    errorBox.textContent = "Please accept the Installer Terms & Conditions.";
                    errorBox.style.display = "block";
                }
                return;
            }

            const accounts = getAccounts();
            const emailExists = accounts.some(acc => (acc.email || "").toLowerCase() === email.toLowerCase());
            if (emailExists) {
                if (errorBox) {
                    errorBox.textContent = "An installer account with this email already exists. Please sign in.";
                    errorBox.style.display = "block";
                }
                return;
            }

            const newInstaller = {
                username: email,
                email: email,
                password: password,
                businessName: businessName || "SolarTech Installer",
                fullName: fullName || "Installer Partner",
                phone: phone || ""
            };

            saveNewAccount(newInstaller);
            setSession(newInstaller);

            if (errorBox) errorBox.style.display = "none";
            window.location.href = "myjob.html";
        });
    }
});
