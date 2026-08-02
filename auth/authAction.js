import { domain } from "../config.js";

/* =========================================================
   DOM ELEMENTS
========================================================= */

const form = document.getElementById("signinForm");

const loginRadio = document.getElementById("login");
const createRadio = document.getElementById("create");
const roleSelect = document.getElementById("role");

const submitButton = document.getElementById("button");
const buttonText = document.getElementById("buttonText");
const buttonLoader = document.getElementById("buttonLoader");

const formDescription =
    document.getElementById("formDescription");

const errorElement =
    document.getElementById("err");

const passwordInput =
    document.getElementById("password");

const togglePasswordButton =
    document.getElementById("togglePassword");

/* =========================================================
   ROLE OPTIONS
========================================================= */

const patientOption =
    new Option("Patient", "PATIENT");

const doctorOption =
    new Option("Doctor", "DOCTOR");

const adminOption =
    new Option("Admin", "ADMIN");

const updateRoleOptions = () => {
    const selectedRole = roleSelect.value;

    roleSelect.innerHTML = "";

    const placeholder =
        new Option("Select your role", "");

    placeholder.disabled = true;

    roleSelect.add(placeholder);
    roleSelect.add(patientOption);
    roleSelect.add(doctorOption);

    /*
     * Admin login is allowed, but an admin account
     * cannot be created through this page.
     */
    if (loginRadio.checked) {
        roleSelect.add(adminOption);
    }

    const allowedRoles = loginRadio.checked
        ? ["PATIENT", "DOCTOR", "ADMIN"]
        : ["PATIENT", "DOCTOR"];

    roleSelect.value =
        allowedRoles.includes(selectedRole)
            ? selectedRole
            : "";
};

/* =========================================================
   FORM MODE
========================================================= */

const updateFormMode = () => {
    errorElement.textContent = "";

    if (createRadio.checked) {
        buttonText.textContent =
            "Create Account";

        formDescription.textContent =
            "Create your account and begin managing your healthcare.";

        passwordInput.autocomplete =
            "new-password";
    } else {
        buttonText.textContent =
            "Log In";

        formDescription.textContent =
            "Log in to access your VedKriti account.";

        passwordInput.autocomplete =
            "current-password";
    }

    updateRoleOptions();
};

const savedMode =
    localStorage.getItem("mode");

if (savedMode === "create") {
    createRadio.checked = true;
} else {
    loginRadio.checked = true;
}

updateFormMode();

loginRadio.addEventListener(
    "change",
    updateFormMode
);

createRadio.addEventListener(
    "change",
    updateFormMode
);

/* =========================================================
   PASSWORD VISIBILITY
========================================================= */

togglePasswordButton.addEventListener(
    "click",
    () => {
        const passwordIsHidden =
            passwordInput.type === "password";

        passwordInput.type =
            passwordIsHidden
                ? "text"
                : "password";

        togglePasswordButton.textContent =
            passwordIsHidden
                ? "Hide"
                : "Show";

        togglePasswordButton.setAttribute(
            "aria-label",
            passwordIsHidden
                ? "Hide password"
                : "Show password"
        );
    }
);

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

const setLoading = (isLoading) => {
    submitButton.disabled = isLoading;
    buttonLoader.hidden = !isLoading;

    buttonText.textContent = isLoading
        ? createRadio.checked
            ? "Creating..."
            : "Logging in..."
        : createRadio.checked
            ? "Create Account"
            : "Log In";
};

const getResponseData = async (response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const saveLoginData = (
    data,
    fallbackRole,
    email
) => {
    const normalizedRole = String(
        data.role || fallbackRole
    ).toUpperCase();

    localStorage.setItem(
        "token",
        data.token
    );

    if (data.userId !== undefined) {
        localStorage.setItem(
            "userId",
            data.userId
        );
    }

    localStorage.setItem(
        "role",
        normalizedRole
    );

    if (data.name !== undefined) {
        localStorage.setItem(
            "name",
            data.name
        );
    }

    localStorage.setItem(
        "email",
        email
    );

    return normalizedRole;
};

/* =========================================================
   PROFILE STATUS
========================================================= */

const getProfileStatus = async (
    role,
    token
) => {
    let endpoint;

    if (role === "PATIENT") {
        endpoint =
            "/api/patient/profile-status";
    } else if (role === "DOCTOR") {
        endpoint =
            "/api/doctor/profile-status";
    } else {
        return false;
    }

    try {
        const response = await fetch(
            `${domain}${endpoint}`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const result =
            await getResponseData(response);

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Unable to check profile status."
            );
        }

        /*
         * Expected backend response:
         *
         * {
         *     data: true
         * }
         */

        if (typeof result.data !== "boolean") {
            throw new Error(
                "Invalid profile-status response received from the server."
            );
        }

        return result.data;
    } catch (error) {
        console.error(
            "Profile-status request failed:",
            error
        );

        errorElement.textContent =
            error.message ||
            "Unable to check your profile status. Please try again.";

        /*
         * null means the request failed.
         * false means the profile is incomplete.
         */
        return null;
    }
};

/* =========================================================
   REDIRECTION
========================================================= */

const redirectUser = (
    role,
    profileCompleted
) => {
    if (role === "ADMIN") {
        window.location.href =
            "../admin-dashboard/home.html";

        return;
    }

    if (role === "PATIENT") {
        window.location.href =
            profileCompleted
                ? "../home/pat-home.html"
                : "../pat-details/details.html";

        return;
    }

    if (role === "DOCTOR") {
        window.location.href =
            profileCompleted
                ? "../doc-dashboard/home.html"
                : "../doc-details/details.html";

        return;
    }

    errorElement.textContent =
        "The server returned an invalid user role.";
};

/* =========================================================
   FORM SUBMISSION
========================================================= */

form.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        errorElement.textContent = "";

        const username =
            document
                .getElementById("username")
                .value
                .trim();

        const password =
            passwordInput.value;

        const email =
            document
                .getElementById("email")
                .value
                .trim();

        const role =
            roleSelect.value;

        if (!role) {
            errorElement.textContent =
                "Please select a role.";

            return;
        }

        /*
         * Prevent admin registration even if someone
         * manually modifies the HTML.
         */
        if (
            createRadio.checked &&
            role === "ADMIN"
        ) {
            errorElement.textContent =
                "An admin account cannot be created from this page.";

            return;
        }

        const endpoint =
            createRadio.checked
                ? "/api/auth/signin-user"
                : "/api/auth/login-user";

        setLoading(true);

        try {
            const response = await fetch(
                `${domain}${endpoint}`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        name: username,
                        password,
                        email,
                        role
                    })
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                errorElement.textContent =
                    data.message ||
                    "Unable to complete your request.";

                return;
            }

            /* Account creation succeeded */

            if (createRadio.checked) {
                localStorage.setItem(
                    "email",
                    email
                );

                localStorage.setItem(
                    "role",
                    role
                );

                window.location.href =
                    "../otp/otp.html";

                return;
            }

            /* Login succeeded */

            if (!data.token) {
                throw new Error(
                    "Access token was not received from the server."
                );
            }

            const normalizedRole =
                saveLoginData(
                    data,
                    role,
                    email
                );

            /*
             * Admin does not require a profile-status request.
             */
            if (normalizedRole === "ADMIN") {
                redirectUser(
                    normalizedRole,
                    false
                );

                return;
            }

            if (
                normalizedRole !== "PATIENT" &&
                normalizedRole !== "DOCTOR"
            ) {
                errorElement.textContent =
                    "The server returned an invalid user role.";

                return;
            }

            const profileCompleted =
                await getProfileStatus(
                    normalizedRole,
                    data.token
                );

            /*
             * Stop redirection if the profile-status
             * request failed.
             */
            if (profileCompleted === null) {
                return;
            }

            redirectUser(
                normalizedRole,
                profileCompleted
            );
        } catch (error) {
            console.error(
                "Authentication failed:",
                error
            );

            errorElement.textContent =
                error.message ||
                "Unable to connect to the server. Please try again.";
        } finally {
            setLoading(false);
        }
    }
);