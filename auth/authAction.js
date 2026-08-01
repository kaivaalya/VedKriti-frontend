import { domain } from "../config.js";

const form = document.getElementById("signinForm");
const loginRadio = document.getElementById("login");
const createRadio = document.getElementById("create");
const roleSelect = document.getElementById("role");

const submitButton = document.getElementById("button");
const buttonText = document.getElementById("buttonText");
const buttonLoader = document.getElementById("buttonLoader");

const formDescription = document.getElementById("formDescription");
const errorElement = document.getElementById("err");

const passwordInput = document.getElementById("password");
const togglePasswordButton = document.getElementById("togglePassword");

const mode = localStorage.getItem("mode");

const patientOption = new Option("Patient", "PATIENT");
const doctorOption = new Option("Doctor", "DOCTOR");
const adminOption = new Option("Admin", "ADMIN");

const updateRoleOptions = () => {
    const selectedRole = roleSelect.value;

    roleSelect.innerHTML = "";

    const placeholder = new Option("Select your role", "");
    placeholder.disabled = true;

    roleSelect.add(placeholder);
    roleSelect.add(patientOption);
    roleSelect.add(doctorOption);

    // Admin is available only while logging in.
    if (loginRadio.checked) {
        roleSelect.add(adminOption);
    }

    const allowedRoles = loginRadio.checked
        ? ["PATIENT", "DOCTOR", "ADMIN"]
        : ["PATIENT", "DOCTOR"];

    if (allowedRoles.includes(selectedRole)) {
        roleSelect.value = selectedRole;
    } else {
        roleSelect.value = "";
    }
};

const updateFormMode = () => {
    errorElement.textContent = "";

    if (createRadio.checked) {
        buttonText.textContent = "Create Account";

        formDescription.textContent =
            "Create your account and begin managing your healthcare.";

        passwordInput.autocomplete = "new-password";
    } else {
        buttonText.textContent = "Log In";

        formDescription.textContent =
            "Log in to access your VedKriti account.";

        passwordInput.autocomplete = "current-password";
    }

    updateRoleOptions();
};

if (mode === "create") {
    createRadio.checked = true;
} else {
    loginRadio.checked = true;
}

updateFormMode();

loginRadio.addEventListener("change", updateFormMode);
createRadio.addEventListener("change", updateFormMode);

togglePasswordButton.addEventListener("click", () => {
    const passwordIsHidden = passwordInput.type === "password";

    passwordInput.type = passwordIsHidden ? "text" : "password";
    togglePasswordButton.textContent = passwordIsHidden ? "Hide" : "Show";

    togglePasswordButton.setAttribute(
        "aria-label",
        passwordIsHidden ? "Hide password" : "Show password"
    );
});

const setLoading = (isLoading) => {
    submitButton.disabled = isLoading;
    buttonLoader.hidden = !isLoading;

    if (isLoading) {
        buttonText.textContent = createRadio.checked
            ? "Creating..."
            : "Logging in...";
    } else {
        buttonText.textContent = createRadio.checked
            ? "Create Account"
            : "Log In";
    }
};

const getResponseData = async (response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    errorElement.textContent = "";

    const username = document.getElementById("username").value.trim();
    const password = passwordInput.value;
    const email = document.getElementById("email").value.trim();
    const role = roleSelect.value;

    if (!role) {
        errorElement.textContent = "Please select a role.";
        return;
    }

    // Prevent ADMIN from being submitted through account creation,
    // even if someone manually changes the HTML.
    if (createRadio.checked && role === "ADMIN") {
        errorElement.textContent =
            "An admin account cannot be created from this page.";
        return;
    }

    const endpoint = createRadio.checked
        ? "/api/auth/signin-user"
        : "/api/auth/login-user";

    setLoading(true);

    try {
        const response = await fetch(`${domain}${endpoint}`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                name: username,
                password,
                email,
                role,
            }),
        });

        const data = await getResponseData(response);

        if (!response.ok) {
            errorElement.textContent =
                data.message || "Unable to complete your request.";

            return;
        }

        if (createRadio.checked) {
            localStorage.setItem("email", email);
            localStorage.setItem("role", role);

            window.location.href = "../otp/otp.html";
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("role", data.role);
        localStorage.setItem("name", data.name);
        localStorage.setItem("email", email);

        const normalizedRole = String(data.role || role).toUpperCase();

        if (normalizedRole === "PATIENT") {
            window.location.href = "../pat-details/details.html";
        } else if (normalizedRole === "DOCTOR") {
            window.location.href = "../doc-details/details.html";
        } else if (normalizedRole === "ADMIN") {
            window.location.href = "../admin-dashboard/home.html";
        }
    } catch (error) {
        console.error(error);

        errorElement.textContent =
            "Unable to connect to the server. Please try again.";
    } finally {
        setLoading(false);
    }
});