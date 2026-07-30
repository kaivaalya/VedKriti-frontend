import { domain } from "../config.js";

const form = document.getElementById("otpForm");
const submit = document.querySelector(".verifyButton");
const resend = document.querySelector(".resendBtn");
const inputs = [...document.querySelectorAll(".otp-input")];
const errorElement = document.getElementById("err");

const purpose =
    localStorage.getItem("otpPurpose") || "SIGNUP";

const ENDPOINTS = {
    SIGNUP: `${domain}/api/auth/verify-user`,

    START_CONSULTATION:
        `${domain}/api/doctor/consultations/verify-start`
};

if (purpose === "START_CONSULTATION") {
    document.getElementById("otpHeading").textContent =
        "Confirm consultation";

    document.getElementById("otpDescription").textContent =
        "Enter the verification code to start this consultation.";
}

inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "");

        if (input.value && inputs[index + 1]) {
            inputs[index + 1].focus();
        }
    });

    input.addEventListener("keydown", (event) => {
        if (
            event.key === "Backspace" &&
            !input.value &&
            inputs[index - 1]
        ) {
            inputs[index - 1].focus();
        }
    });

    input.addEventListener("paste", (event) => {
        const digits = event.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);

        if (!digits) return;

        event.preventDefault();

        digits.split("").forEach((digit, digitIndex) => {
            if (inputs[digitIndex]) {
                inputs[digitIndex].value = digit;
            }
        });

        inputs[
            Math.min(digits.length, inputs.length) - 1
        ].focus();
    });
});

const readJSON = async (response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const otp = inputs
        .map((input) => input.value)
        .join("");

    if (otp.length !== inputs.length) {
        errorElement.textContent =
            "Please enter the complete OTP.";

        return;
    }

    submit.disabled = true;
    submit.textContent = "Verifying...";
    errorElement.textContent = "";

    try {
        const payload =
            purpose === "START_CONSULTATION"
                ? {
                    otp,
                    bookingId: localStorage.getItem(
                        "currentConsultationBookingId"
                    )
                }
                : {
                    otp,
                    email: localStorage.getItem("email")
                };

        const response = await fetch(
            ENDPOINTS[purpose] || ENDPOINTS.SIGNUP,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",

                    Authorization:
                        `Bearer ${
                            localStorage.getItem("token") || ""
                        }`
                },

                body: JSON.stringify(payload)
            }
        );

        const data = await readJSON(response);

        if (!response.ok) {
            throw new Error(
                data.message || "OTP verification failed."
            );
        }

        localStorage.removeItem("otpPurpose");

        if (purpose === "START_CONSULTATION") {
            globalThis.location.href =
                "../doctor/home.html";

            return;
        }

        const role = String(
            localStorage.getItem("role") || ""
        ).toUpperCase();

        globalThis.location.href =
            role === "PATIENT"
                ? "../pat-details/details.html"
                : "../doc-details/details.html";
    } catch (error) {
        errorElement.textContent = error.message;
    } finally {
        submit.disabled = false;
        submit.textContent = "Verify OTP";
    }
});

resend.addEventListener("click", async (event) => {
    event.preventDefault();

    const response = await fetch(
        `${domain}/api/auth/resend-otp`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",

                Authorization:
                    `Bearer ${localStorage.getItem("token")}`
            },

            body: JSON.stringify({
                email: localStorage.getItem("email")
            })
        }
    );

    const data = await readJSON(response);

    errorElement.textContent = response.ok
        ? data.message || "A new code has been sent."
        : data.message || "Unable to resend the code.";
});