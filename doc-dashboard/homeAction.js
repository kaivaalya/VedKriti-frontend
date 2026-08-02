import { domain } from "../config.js";

/*
 * Change these paths if your backend uses different routes.
 */
const ENDPOINTS = {
    search:
        `${domain}/api/booking/doctor-bookings`,

    today:
        `${domain}/api/booking/doctor-bookings`,

    emergencyCancel:
        `${domain}/api/booking/emergency-cancel`,

    start: (bookingId, otp) =>
        `${domain}/api/booking/start-consultation?id=${
            encodeURIComponent(bookingId)
        }&otp=${encodeURIComponent(otp)}`,

    end: (bookingId) =>
        `${domain}/api/booking/end-consultation?id=${
            encodeURIComponent(bookingId)
        }`,

    conference: (bookingId) =>
        `${domain}/api/booking/agora-token?bookingId=${
            encodeURIComponent(bookingId)
        }`,

    uploadReport: (patientId) =>
        `${domain}/api/report/upload-report?id=${
            encodeURIComponent(patientId)
        }`
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

const extractArray = (
    responseData,
    possibleKeys
) => {
    if (Array.isArray(responseData)) {
        return responseData;
    }

    if (Array.isArray(responseData?.data)) {
        return responseData.data;
    }

    for (const key of possibleKeys) {
        if (
            Array.isArray(responseData?.[key])
        ) {
            return responseData[key];
        }

        if (
            Array.isArray(
                responseData?.data?.[key]
            )
        ) {
            return responseData.data[key];
        }
    }

    return [];
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

/*
 * Returns local date instead of UTC date.
 *
 * Example:
 * 2026-08-01
 */
const getTodayDate = () => {
    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
    if (!value) {
        return "Date not provided";
    }

    const dateValue =
        String(value).slice(0, 10);

    const date =
        new Date(`${dateValue}T00:00:00`);

    if (
        Number.isNaN(date.getTime())
    ) {
        return String(value);
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
};

const getBookingId = (booking) =>
    booking.bookingID ||
    booking.bookingId ||
    booking.id ||
    booking._id;

/* =========================================================
   ELEMENT REFERENCES
========================================================= */

const tabContainer =
    $(".tabs-container");

const panels =
    $$(".tabs_panel > section");

const todayResults =
    $("#todayResults");

const searchResults =
    $("#searchResults");

const consultationMessage =
    $("#consultationMessage");

const searchMessage =
    $("#searchMessage");

/* =========================================================
   TAB SWITCHING
========================================================= */

const openTab = async (panelId) => {
    panels.forEach((panel) => {
        panel.hidden =
            panel.id !== panelId;
    });

    $$("a", tabContainer)
        .forEach((link) => {
            const active =
                link.getAttribute("href") ===
                `#${panelId}`;

            link.classList.toggle(
                "active-tab",
                active
            );

            link.setAttribute(
                "aria-selected",
                String(active)
            );
        });

    if (panelId === "consultations") {
        await loadTodayConsultations();
    }
};

tabContainer.addEventListener(
    "click",
    async (event) => {
        const link =
            event.target.closest("a");

        if (!link) {
            return;
        }

        event.preventDefault();

        const panelId =
            link
                .getAttribute("href")
                .slice(1);

        await openTab(panelId);
    }
);

/* =========================================================
   CONSULTATION ACTION BUTTONS
========================================================= */

const consultationActions = (booking, isSearch = false) => {
    const bookingId =
        getBookingId(booking);

    const status =
        String(
            booking.status || ""
        ).toUpperCase();

    const consultationType =
        String(
            booking.consultationType ||
            "OFFLINE"
        ).toUpperCase();

    if (
        status === "WAITING" ||
        status === "WAITLISTED"
    ) {
        return `
            <button
                type="button"
                class="remove-wl"
                data-action="remove-waiting"
                data-booking-id="${escapeHTML(
                    bookingId
                )}"
            >
                Remove from Waiting List
            </button>
        `;
    }

    if (
        status === "CONFIRMED" ||
        status === "BOOKED"
    ) {
        return `
            <button
                type="button"
                class="start-consultation"
                data-action="start"
                data-booking-id="${escapeHTML(
                    bookingId
                )}"
            >
                Start Consultation
            </button>
        `;
    }

    if (status === "CONSULTING") {
        const conferenceButton =
            consultationType === "ONLINE"
                ? `
                    <button
                        type="button"
                        class="join-conference"
                        data-action="join"
                        data-booking-id="${escapeHTML(
                            bookingId
                        )}"
                    >
                        Join Conference
                    </button>
                `
                : "";

        return `
            ${conferenceButton}

            <button
                type="button"
                class="end-consultation"
                data-action="end"
                data-booking-id="${escapeHTML(
                    bookingId
                )}"
            >
                End Consultation
            </button>
        `;
    }

    if (status === "DONE" && !isSearch) {
        return `
            <label class="upload-report-btn button" style="cursor:pointer; display:inline-block; padding:8px 16px; background:var(--primary, #007bff); color:#fff; border-radius:4px; text-align:center;">
                Capture Report
                <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    class="upload-report-input"
                    data-action="upload-report"
                    data-booking-id="${escapeHTML(bookingId)}"
                    data-patient-id="${escapeHTML(booking.patID || booking.patient?._id || booking.patientId || '')}"
                    style="display: none;"
                />
            </label>
        `;
    }

    return "";
};

/* =========================================================
   CONSULTATION CARD
========================================================= */

const consultationCard = (booking, isSearch = false) => {
    const status =
        String(
            booking.status || "UNKNOWN"
        ).toUpperCase();

    const patientName =
        booking.patientName ||
        booking.patName ||
        booking.patient?.name ||
        "Patient";

    const slot =
        booking.slot ||
        booking.bookingSlot ||
        booking.shift ||
        "Slot not provided";

    const tokenNumber =
        booking.tokenNumber ??
        booking.token ??
        "Not assigned";

    const consultationType =
        booking.consultationType ||
        "OFFLINE";

    const bookingDate =
        booking.date ||
        booking.bookingDate;

    return `
        <article class="card">
            <div class="card-content">
                <h2>
                    ${escapeHTML(patientName)}
                </h2>

                <div class="booking-meta">
                    <span>
                        ${escapeHTML(slot)}
                    </span>

                    <span>
                        Token:
                        ${escapeHTML(tokenNumber)}
                    </span>

                    <span>
                        ${escapeHTML(
                            consultationType
                        )}
                    </span>

                    <span
                        class="status status-${
                            status.toLowerCase()
                        }"
                    >
                        ${escapeHTML(status)}
                    </span>
                </div>

                <p class="booking-date">
                    ${escapeHTML(
                        formatDate(bookingDate)
                    )}
                </p>

                ${
                    isSearch && booking.rating
                        ? `
                            <p class="rating">
                                <strong>Rating:</strong> ${escapeHTML(booking.rating)}
                            </p>
                        `
                        : ""
                }
                ${
                    isSearch && booking.feedback
                        ? `
                            <p class="feedback">
                                <strong>Feedback:</strong> ${escapeHTML(booking.feedback)}
                            </p>
                        `
                        : ""
                }

                ${
                    booking.reason
                        ? `
                            <p class="feedback">
                                <strong>Reason:</strong> ${escapeHTML(
                                    booking.reason
                                )}
                            </p>
                        `
                        : ""
                }
            </div>

            <div class="card-actions">
                ${consultationActions(booking, isSearch)}
            </div>
        </article>
    `;
};

const renderConsultations = (
    container,
    consultations,
    isSearch = false
) => {
    if (!consultations.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>No consultations found</h2>

                <p>
                    Consultations will appear here.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        consultations
            .map(c => consultationCard(c, isSearch))
            .join("");
};

/* =========================================================
   LOAD TODAY'S CONSULTATIONS
========================================================= */

const loadTodayConsultations = async () => {
    const refreshButton =
        $("#refreshConsultations");

    const today =
        getTodayDate();

    refreshButton.disabled = true;
    refreshButton.textContent =
        "Loading...";

    setMessage(
        consultationMessage,
        "Loading today's consultations..."
    );

    try {
        const response = await fetch(
            `${ENDPOINTS.today}?date=${
                encodeURIComponent(today)
            }`,
            {
                method: "GET",
                headers: authHeaders(),
                credentials: "include"
            }
        );

        const data =
            await readJSON(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load today's consultations."
            );
        }

        const consultations =
            extractArray(
                data,
                [
                    "consultations",
                    "bookings"
                ]
            );

        renderConsultations(
            todayResults,
            consultations
        );

        setMessage(
            consultationMessage,
            `${consultations.length} consultation(s) scheduled for today.`,
            "success"
        );
    } catch (error) {
        renderConsultations(
            todayResults,
            []
        );

        setMessage(
            consultationMessage,
            error.message,
            "error"
        );
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent =
            "Refresh";
    }
};

$("#refreshConsultations").addEventListener(
    "click",
    loadTodayConsultations
);

/* =========================================================
   EMERGENCY CANCELLATION
========================================================= */

$("#emergencyCancelForm").addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const form =
            event.currentTarget;

        const button =
            $("#emergencyCancel");

        const reason =
            $("#emergencyReason")
                .value
                .trim();

        const today =
            getTodayDate();

        if (!reason) {
            setMessage(
                consultationMessage,
                "Please enter a cancellation reason.",
                "error"
            );

            return;
        }

        const confirmed =
            globalThis.confirm(
                `Cancel all remaining consultations for ${today}?`
            );

        if (!confirmed) {
            return;
        }

        button.disabled = true;
        button.textContent =
            "Cancelling...";

        setMessage(
            consultationMessage,
            "Cancelling today's remaining consultations..."
        );

        try {
            const response = await fetch(
                ENDPOINTS.emergencyCancel,
                {
                    method: "PUT",

                    headers:
                        authHeaders(true),

                    credentials:
                        "include",

                    body:
                        JSON.stringify({
                            reason,
                            date: today
                        })
                }
            );

            const data =
                await readJSON(response);

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Emergency cancellation failed."
                );
            }

            form.reset();

            setMessage(
                consultationMessage,
                data.message ||
                "Today's remaining consultations were cancelled.",
                "success"
            );

            await loadTodayConsultations();
        } catch (error) {
            setMessage(
                consultationMessage,
                error.message,
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent =
                "Emergency Cancel Today";
        }
    }
);

/* =========================================================
   SEARCH CONSULTATIONS
========================================================= */

$("#searchForm").addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const searchButton =
            $("#search");

        const selectedDate =
            $("#date").value;

        if (!selectedDate) {
            setMessage(
                searchMessage,
                "Please select a date.",
                "error"
            );

            return;
        }

        searchButton.disabled = true;
        searchButton.textContent =
            "Searching...";

        setMessage(
            searchMessage,
            "Searching consultations..."
        );

        try {
            const response = await fetch(
                `${ENDPOINTS.search}?date=${
                    encodeURIComponent(
                        selectedDate
                    )
                }`,
                {
                    method: "GET",
                    headers: authHeaders(),
                    credentials: "include"
                }
            );

            const data =
                await readJSON(response);

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to search consultations."
                );
            }

            const consultations =
                extractArray(
                    data,
                    [
                        "consultations",
                        "bookings"
                    ]
                );

            renderConsultations(
                searchResults,
                consultations,
                true
            );

            setMessage(
                searchMessage,
                `${consultations.length} result(s) found.`,
                "success"
            );
        } catch (error) {
            renderConsultations(
                searchResults,
                []
            );

            setMessage(
                searchMessage,
                error.message,
                "error"
            );
        } finally {
            searchButton.disabled = false;
            searchButton.textContent =
                "Search";
        }
    }
);

/* =========================================================
   CONSULTATION ACTIONS
========================================================= */

todayResults.addEventListener(
    "click",
    async (event) => {
        const button =
            event.target.closest(
                "button[data-action]"
            );

        if (!button) {
            return;
        }

        const bookingId =
            button.dataset.bookingId;

        const action =
            button.dataset.action;

        if (!bookingId) {
            setMessage(
                consultationMessage,
                "Booking ID is missing.",
                "error"
            );

            return;
        }

        if (action === "join") {
            await joinConference(
                bookingId,
                button
            );

            return;
        }

        if (
            action === "remove-waiting"
        ) {
            setMessage(
                consultationMessage,
                "Connect this button to your waiting-list removal endpoint.",
                "error"
            );

            return;
        }

        if (
            action !== "start" &&
            action !== "end"
        ) {
            return;
        }

        const isStarting =
            action === "start";

        const originalText =
            button.textContent;

        button.disabled = true;

        button.textContent =
            isStarting
                ? "Starting..."
                : "Ending...";

        try {
            let endpoint;

            if (isStarting) {
                const otp = globalThis.prompt(
                    "Enter the OTP to start this consultation:"
                );

                if (otp === null) {
                    button.disabled = false;
                    button.textContent = originalText;
                    return;
                }

                endpoint = ENDPOINTS.start(bookingId, otp.trim());
            } else {
                endpoint = ENDPOINTS.end(bookingId);
            }

            const response = await fetch(
                endpoint,
                {
                    method: "PUT",

                    headers:
                        authHeaders(),

                    credentials:
                        "include"
                }
            );

            const data =
                await readJSON(response);

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Unable to update consultation.`
                );
            }

            setMessage(
                consultationMessage,
                data.message ||
                `Consultation updated.`,
                "success"
            );

            await loadTodayConsultations();
        } catch (error) {
            setMessage(
                consultationMessage,
                error.message,
                "error"
            );

            button.disabled = false;
            button.textContent =
                originalText;
        }
    }
);

todayResults.addEventListener(
    "change",
    async (event) => {
        const input = event.target;

        if (!input.classList.contains("upload-report-input")) {
            return;
        }

        const file = input.files[0];
        if (!file) return;

        const bookingId = input.dataset.bookingId;
        const patientId = input.dataset.patientId || "unknown";

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", "Consultation Report");
        formData.append("category", "PRESCRIPTION");
        formData.append("bookingId", bookingId);

        setMessage(
            consultationMessage,
            "Uploading report..."
        );

        try {
            const response = await fetch(
                ENDPOINTS.uploadReport(patientId),
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${getToken()}`
                    },
                    body: formData
                }
            );

            const data = await readJSON(response);

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to upload report."
                );
            }

            setMessage(
                consultationMessage,
                "Report uploaded successfully.",
                "success"
            );
            
            // Clear input so it can be uploaded again if needed
            input.value = "";
        } catch (error) {
            setMessage(
                consultationMessage,
                error.message,
                "error"
            );
            input.value = "";
        }
    }
);

/* =========================================================
   JOIN ONLINE CONFERENCE
========================================================= */

const joinConference = async (
    bookingId,
    button
) => {
    const originalText =
        button.textContent;

    button.disabled = true;
    button.textContent =
        "Joining...";

    try {
        const response = await fetch(
            ENDPOINTS.conference(
                bookingId
            ),
            {
                method: "GET",
                headers: authHeaders(),
                credentials: "include"
            }
        );

        await console.log(response);

        const data =
            await readJSON(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to fetch conference credentials."
            );
        }

        const credentials =
            data.data || data;

        console.log(
            "Conference credentials received:",
            credentials
        );

        const appId =
            credentials.appId ||
            credentials.agoraAppId;

        const channel =
            credentials.channelName ||
            credentials.channel;

        const conferenceToken =
            credentials.token ||
            credentials.rtcToken;

        const conferenceUid =
            Number(credentials.uid);

        if (
            !appId ||
            !channel ||
            !conferenceToken ||
            !Number.isInteger(conferenceUid) ||
            conferenceUid <= 0
        ) {
            throw new Error(
                "The backend returned incomplete Agora credentials."
            );
        }

        localStorage.setItem(
            "agoraAppId",
            appId
        );

        localStorage.setItem(
            "conferenceChannel",
            channel
        );

        localStorage.setItem(
            "conferenceToken",
            conferenceToken
        );

        localStorage.setItem(
            "conferenceUid",
            String(conferenceUid)
        );

        localStorage.setItem(
            "currentConsultationBookingId",
            bookingId
        );

        console.log(
            "Saved conference UID:",
            localStorage.getItem("conferenceUid")
        );

        globalThis.location.href =
            "../conference/index.html";
    } catch (error) {
        setMessage(
            consultationMessage,
            error.message,
            "error"
        );

        button.disabled = false;
        button.textContent =
            originalText;
    }
};

/* =========================================================
   INITIAL PAGE SETUP
========================================================= */

$("#date").max =
    getTodayDate();

openTab("find");