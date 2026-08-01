import { domain } from "../config.js";

/*
 * Change these paths if your Express router uses
 * different admin routes.
 */
const ENDPOINTS = {
    statistics:
        `${domain}/api/admin/statistics`,

    findDoctors:
        `${domain}/api/doctors/find-doctor`,

    removeDoctor: (doctorId) =>
        `${domain}/api/admin/doctors/${
            encodeURIComponent(doctorId)
        }`,

    pendingDoctors:
        `${domain}/api/admin/doctors/pending`,

    verifyDoctor: (doctorId) =>
        `${domain}/api/admin/doctors/${
            encodeURIComponent(doctorId)
        }/verify`
};

/* =========================================================
   HELPERS
========================================================= */

const $ = (
    selector,
    parent = document
) => parent.querySelector(selector);

const $$ = (
    selector,
    parent = document
) => [...parent.querySelectorAll(selector)];

const getToken = () =>
    localStorage.getItem("token") || "";

const authHeaders = (
    includeJSON = false
) => ({
    Authorization:
        `Bearer ${getToken()}`,

    ...(includeJSON
        ? {
            "Content-Type":
                "application/json"
        }
        : {})
});

const escapeHTML = (value) =>
    String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

const readJSON = async (response) => {
    const contentType =
        response.headers.get("content-type") || "";

    if (
        !contentType.includes("application/json")
    ) {
        throw new Error(
            "The server returned an invalid response."
        );
    }

    return response.json();
};

const setMessage = (
    element,
    text = "",
    state = ""
) => {
    if (!element) {
        return;
    }

    element.textContent = text;

    element.className =
        `message${state ? ` ${state}` : ""}`;
};

const formatNumber = (value) =>
    Number(value || 0).toLocaleString("en-IN");

const formatFee = (value) => {
    const fee = Number(value);

    if (!Number.isFinite(fee)) {
        return "Fee not provided";
    }

    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }
    ).format(fee);
};

const getDoctorId = (doctor) =>
    doctor._id ||
    doctor.id ||
    doctor.doctorID ||
    doctor.docID;

const extractDoctors = (data) => {
    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data?.data)) {
        return data.data;
    }

    if (Array.isArray(data?.doctors)) {
        return data.doctors;
    }

    if (Array.isArray(data?.data?.doctors)) {
        return data.data.doctors;
    }

    return [];
};

/* =========================================================
   TAB SWITCHING
========================================================= */

const loadedPanels = {
    statistics: false,
    doctors: false,
    verify: false
};

const openTab = async (panelId) => {
    $$(".tab-panel").forEach((panel) => {
        panel.hidden =
            panel.id !== panelId;
    });

    $$(".tab").forEach((tab) => {
        const active =
            tab.dataset.panel === panelId;

        tab.classList.toggle(
            "active",
            active
        );

        tab.setAttribute(
            "aria-selected",
            String(active)
        );
    });

    if (
        panelId === "statistics" &&
        !loadedPanels.statistics
    ) {
        await loadStatistics();
    }

    if (
        panelId === "doctors" &&
        !loadedPanels.doctors
    ) {
        await findDoctors();

        loadedPanels.doctors = true;
    }

    if (
        panelId === "verify" &&
        !loadedPanels.verify
    ) {
        await loadPendingDoctors();

        loadedPanels.verify = true;
    }
};

$(".tabs-container").addEventListener(
    "click",
    (event) => {
        const tab =
            event.target.closest(".tab");

        if (!tab) {
            return;
        }

        openTab(tab.dataset.panel);
    }
);

/* =========================================================
   PLATFORM STATISTICS
========================================================= */

const renderStatistics = (stats) => {
    const totalDoctors =
        Number(stats.totalDoctors || 0);

    const verifiedDoctors =
        Number(stats.verifiedDoctors || 0);

    const pendingDoctors =
        Number(stats.pendingDoctors || 0);

    const totalBookings =
        Number(stats.totalBookings || 0);

    const completedConsultations =
        Number(
            stats.completedConsultations || 0
        );

    const verifiedPercentage =
        totalDoctors > 0
            ? (
                verifiedDoctors /
                totalDoctors
            ) * 100
            : 0;

    const completionRate =
        totalBookings > 0
            ? (
                completedConsultations /
                totalBookings
            ) * 100
            : 0;

    $("#totalDoctors").textContent =
        formatNumber(totalDoctors);

    $("#verifiedDoctors").textContent =
        formatNumber(verifiedDoctors);

    $("#pendingDoctors").textContent =
        formatNumber(pendingDoctors);

    $("#totalPatients").textContent =
        formatNumber(stats.totalPatients);

    $("#totalBookings").textContent =
        formatNumber(totalBookings);

    $("#completedConsultations").textContent =
        formatNumber(completedConsultations);

    $("#completionRate").textContent =
        `${Math.round(completionRate)}% completion rate`;

    $("#verifiedPercentage").textContent =
        `${Math.round(verifiedPercentage)}%`;

    $("#doctorPieChart").style.background = `
        conic-gradient(
            var(--primary)
            0%
            ${verifiedPercentage}%,

            var(--gold)
            ${verifiedPercentage}%
            100%
        )
    `;

    $("#statisticsLoader").hidden = true;
    $("#statisticsContent").hidden = false;
};

const loadStatistics = async () => {
    const loader =
        $("#statisticsLoader");

    loader.hidden = false;
    loader.textContent =
        "Loading platform statistics...";

    try {
        const response = await fetch(
            ENDPOINTS.statistics,
            {
                method: "GET",
                headers: authHeaders()
            }
        );

        const data =
            await readJSON(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load platform statistics."
            );
        }

        renderStatistics(
            data.data || data
        );

        loadedPanels.statistics = true;
    } catch (error) {
        loader.textContent =
            error.message;
    }
};

/* =========================================================
   DOCTOR CARDS
========================================================= */

const doctorSpecializations = (doctor) =>
    [
        doctor.specialization1,
        doctor.specialization2,
        doctor.specialization3
    ]
        .filter(Boolean)
        .join(" · ");

const doctorPhoto = (doctor) => {
    if (doctor.photo) {
        return `
            <img
                class="doctor-photo"
                src="${escapeHTML(doctor.photo)}"
                alt="${escapeHTML(
                    doctor.name || "Doctor"
                )}"
            >
        `;
    }

    const firstLetter =
        String(
            doctor.name || "D"
        ).charAt(0);

    return `
        <div
            class="doctor-photo photo-placeholder"
            aria-hidden="true"
        >
            ${escapeHTML(firstLetter)}
        </div>
    `;
};

const doctorCard = (doctor) => {
    const doctorId =
        getDoctorId(doctor);

    const location = [
        doctor.facilityName,
        doctor.city,
        doctor.state,
        doctor.country
    ]
        .filter(Boolean)
        .join(", ");

    const rating =
        Number(doctor.rating || 0);

    return `
        <article
            class="doctor-card"
            data-doctor-id="${escapeHTML(doctorId)}"
        >
            ${doctorPhoto(doctor)}

            <div class="doctor-details">
                <div>
                    <h3>
                        ${escapeHTML(
                            doctor.name ||
                            "Doctor"
                        )}
                    </h3>

                    <p class="specialization">
                        ${escapeHTML(
                            doctorSpecializations(
                                doctor
                            ) ||
                            "Specialization not provided"
                        )}
                    </p>
                </div>

                <span class="doctor-rating">
                    ★ ${escapeHTML(
                        rating.toFixed(1)
                    )}
                </span>

                <p class="doctor-location">
                    ${escapeHTML(
                        location ||
                        "Location not provided"
                    )}

                    ${
                        doctor.institute
                            ? `
                                <br>

                                <span>
                                    ${escapeHTML(
                                        doctor.institute
                                    )}
                                </span>
                            `
                            : ""
                    }
                </p>

                <p class="doctor-fee">
                    <strong>
                        ${escapeHTML(
                            formatFee(
                                doctor.consultationFee
                            )
                        )}
                    </strong>

                    consultation fee
                </p>
            </div>

            <button
                class="delete-doctor"
                type="button"
                data-doctor-id="${escapeHTML(doctorId)}"
                data-doctor-name="${escapeHTML(
                    doctor.name || "this doctor"
                )}"
            >
                Delete Doctor
            </button>
        </article>
    `;
};

const renderDoctors = (doctors) => {
    const container =
        $("#doctorResults");

    $("#doctorCount").textContent =
        `${doctors.length} doctor${
            doctors.length === 1 ? "" : "s"
        } found`;

    if (!doctors.length) {
        container.innerHTML = `
            <div class="empty-state">
                No doctors matched the selected filters.
            </div>
        `;

        return;
    }

    container.innerHTML =
        doctors
            .map(doctorCard)
            .join("");
};

/* =========================================================
   SEARCH VERIFIED DOCTORS
========================================================= */

const createSearchParameters = () => {
    const parameters =
        new URLSearchParams();

    const filters = {
        city:
            $("#city").value.trim(),

        facilityName:
            $("#facilityName").value.trim(),

        specialization:
            $("#specialization").value.trim(),

        name:
            $("#doctorName").value.trim(),

        minFee:
            $("#minFee").value.trim(),

        maxFee:
            $("#maxFee").value.trim(),

        minRating:
            $("#minRating").value.trim()
    };

    Object.entries(filters)
        .forEach(([key, value]) => {
            if (value !== "") {
                parameters.set(key, value);
            }
        });

    return parameters;
};

const findDoctors = async () => {
    const searchButton =
        $("#searchDoctors");

    const message =
        $("#doctorMessage");

    const parameters =
        createSearchParameters();

    const minFee =
        Number($("#minFee").value);

    const maxFee =
        Number($("#maxFee").value);

    if (
        $("#minFee").value &&
        $("#maxFee").value &&
        minFee > maxFee
    ) {
        setMessage(
            message,
            "Minimum fee cannot be greater than maximum fee.",
            "error"
        );

        return;
    }

    searchButton.disabled = true;
    searchButton.textContent =
        "Searching...";

    setMessage(
        message,
        "Searching for doctors..."
    );

    try {
        const response = await fetch(
            `${ENDPOINTS.findDoctors}?${parameters}`,
            {
                method: "GET",
                headers: authHeaders()
            }
        );

        const data =
            await readJSON(response);

        /*
         * Your backend returns 404 when no doctors are found.
         * Treat that as an empty search result.
         */
        if (
            response.status === 404
        ) {
            renderDoctors([]);

            setMessage(
                message,
                data.message ||
                "No doctors found."
            );

            return;
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to search for doctors."
            );
        }

        const doctors =
            extractDoctors(data);

        renderDoctors(doctors);

        setMessage(
            message,
            `${doctors.length} doctor(s) loaded.`,
            "success"
        );
    } catch (error) {
        setMessage(
            message,
            error.message,
            "error"
        );
    } finally {
        searchButton.disabled = false;
        searchButton.textContent =
            "Search Doctors";
    }
};

$("#doctorSearchForm").addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        await findDoctors();
    }
);

$("#clearFilters").addEventListener(
    "click",
    async () => {
        $("#doctorSearchForm").reset();

        await findDoctors();
    }
);

/* =========================================================
   DELETE DOCTOR
========================================================= */

$("#doctorResults").addEventListener(
    "click",
    async (event) => {
        const button =
            event.target.closest(
                ".delete-doctor"
            );

        if (!button) {
            return;
        }

        const doctorId =
            button.dataset.doctorId;

        const doctorName =
            button.dataset.doctorName;

        const confirmed =
            globalThis.confirm(
                `Are you sure you want to remove ${doctorName}?`
            );

        if (!confirmed) {
            return;
        }

        button.disabled = true;
        button.textContent =
            "Deleting...";

        try {
            const response = await fetch(
                ENDPOINTS.removeDoctor(
                    doctorId
                ),
                {
                    method: "DELETE",
                    headers: authHeaders()
                }
            );

            const data =
                await readJSON(response);

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to remove doctor."
                );
            }

            button
                .closest(".doctor-card")
                .remove();

            const remainingDoctors =
                $$(".doctor-card",
                    $("#doctorResults")
                ).length;

            $("#doctorCount").textContent =
                `${remainingDoctors} doctor${
                    remainingDoctors === 1
                        ? ""
                        : "s"
                } found`;

            setMessage(
                $("#doctorMessage"),
                data.message ||
                "Doctor removed successfully.",
                "success"
            );

            /*
             * Statistics have changed, so reload them
             * the next time the tab is opened.
             */
            loadedPanels.statistics = false;
        } catch (error) {
            setMessage(
                $("#doctorMessage"),
                error.message,
                "error"
            );

            button.disabled = false;
            button.textContent =
                "Delete Doctor";
        }
    }
);

/* =========================================================
   PENDING DOCTOR CARDS
========================================================= */

const pendingDoctorCard = (doctor) => {
    const doctorId =
        getDoctorId(doctor);

    return `
        <article
            class="doctor-card pending-doctor-card"
            data-doctor-id="${escapeHTML(doctorId)}"
        >
            ${doctorPhoto(doctor)}

            <div class="doctor-details">
                <div>
                    <h3>
                        ${escapeHTML(
                            doctor.name ||
                            "Doctor"
                        )}
                    </h3>

                    <p class="specialization">
                        ${escapeHTML(
                            doctor.specialization1 ||
                            "Specialization not provided"
                        )}
                    </p>
                </div>

                <p class="doctor-location">
                    ${escapeHTML(
                        doctor.institute ||
                        "Institute not provided"
                    )}

                    <br>

                    <span>
                        ${escapeHTML(
                            [
                                doctor.city,
                                doctor.email
                            ]
                                .filter(Boolean)
                                .join(" · ")
                        )}
                    </span>
                </p>
            </div>

            <form
                class="verification-form"
                data-doctor-id="${escapeHTML(doctorId)}"
            >
                <div class="verification-options">
                    <label>
                        <input
                            type="radio"
                            name="verified"
                            value="true"
                            required
                        >

                        Approve
                    </label>

                    <label>
                        <input
                            type="radio"
                            name="verified"
                            value="false"
                            required
                        >

                        Decline
                    </label>
                </div>

                <textarea
                    name="verificationNote"
                    maxlength="1000"
                    placeholder="Add verification remarks (optional)"
                ></textarea>

                <button
                    class="primary-button submit-verification"
                    type="submit"
                >
                    Submit Decision
                </button>

                <p
                    class="message form-message"
                    aria-live="polite"
                ></p>
            </form>
        </article>
    `;
};

const updatePendingCount = (count) => {
    $("#pendingCount").textContent =
        String(count);

    const badge =
        $("#pendingBadge");

    badge.textContent =
        String(count);

    badge.hidden =
        count === 0;
};

const renderPendingDoctors = (doctors) => {
    const container =
        $("#pendingDoctorResults");

    updatePendingCount(
        doctors.length
    );

    if (!doctors.length) {
        container.innerHTML = `
            <div class="empty-state">
                All doctor applications have been reviewed.
            </div>
        `;

        return;
    }

    container.innerHTML =
        doctors
            .map(pendingDoctorCard)
            .join("");
};

/* =========================================================
   LOAD PENDING DOCTORS
========================================================= */

const loadPendingDoctors = async () => {
    const message =
        $("#verificationMessage");

    setMessage(
        message,
        "Loading pending applications..."
    );

    try {
        const response = await fetch(
            ENDPOINTS.pendingDoctors,
            {
                method: "GET",
                headers: authHeaders()
            }
        );

        const data =
            await readJSON(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load pending doctors."
            );
        }

        const doctors =
            extractDoctors(data);

        renderPendingDoctors(doctors);

        setMessage(
            message,
            `${doctors.length} pending application(s).`,
            "success"
        );
    } catch (error) {
        setMessage(
            message,
            error.message,
            "error"
        );
    }
};

/* =========================================================
   VERIFY OR DECLINE DOCTOR
========================================================= */

$("#pendingDoctorResults").addEventListener(
    "submit",
    async (event) => {
        const form =
            event.target.closest(
                ".verification-form"
            );

        if (!form) {
            return;
        }

        event.preventDefault();

        const doctorId =
            form.dataset.doctorId;

        const selectedDecision =
            form.querySelector(
                'input[name="verified"]:checked'
            );

        const verificationNote =
            form.querySelector(
                'textarea[name="verificationNote"]'
            ).value.trim();

        const message =
            $(".form-message", form);

        const submitButton =
            $(".submit-verification", form);

        if (!selectedDecision) {
            setMessage(
                message,
                "Select Approve or Decline.",
                "error"
            );

            return;
        }

        /*
         * Radio values are strings, so explicitly
         * convert them into booleans.
         */
        const verified =
            selectedDecision.value === "true";

        submitButton.disabled = true;
        submitButton.textContent =
            "Submitting...";

        try {
            const response = await fetch(
                ENDPOINTS.verifyDoctor(
                    doctorId
                ),
                {
                    method: "PATCH",

                    headers:
                        authHeaders(true),

                    body:
                        JSON.stringify({
                            verified,
                            verificationNote
                        })
                }
            );

            const data =
                await readJSON(response);

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to update verification."
                );
            }

            form
                .closest(".doctor-card")
                .remove();

            const remainingDoctors =
                $$(".pending-doctor-card").length;

            updatePendingCount(
                remainingDoctors
            );

            if (
                remainingDoctors === 0
            ) {
                $("#pendingDoctorResults")
                    .innerHTML = `
                        <div class="empty-state">
                            All doctor applications have been reviewed.
                        </div>
                    `;
            }

            setMessage(
                $("#verificationMessage"),
                data.message ||
                (
                    verified
                        ? "Doctor verified successfully."
                        : "Doctor verification rejected."
                ),
                "success"
            );

            /*
             * Verification changes both statistics
             * and verified doctor search results.
             */
            loadedPanels.statistics = false;
            loadedPanels.doctors = false;
        } catch (error) {
            setMessage(
                message,
                error.message,
                "error"
            );

            submitButton.disabled = false;
            submitButton.textContent =
                "Submit Decision";
        }
    }
);

/* =========================================================
   INITIAL PAGE LOAD
========================================================= */

openTab("statistics");

/*
 * Load the pending count immediately so the badge
 * is visible even before opening the verification tab.
 */
loadPendingDoctors()
    .then(() => {
        loadedPanels.verify = true;
    });