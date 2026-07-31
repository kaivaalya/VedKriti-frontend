import { domain } from "../config.js";

const ENDPOINTS = {
    search: `${domain}/api/booking/doctor-booking`,//set
    today: `${domain}/api/booking/doctor-booking/date?=${getTodayDate}`,//set
    availability: `${domain}/api/doctor/availability`,

    emergencyCancel:
        `${domain}/api/doctor/consultations/emergency-cancel`,

    start: (bookingId) =>
        `${domain}/api/doctor/consultations/${
            encodeURIComponent(bookingId)
        }/start`,

    end: (bookingId) =>
        `${domain}/api/doctor/consultations/${
            encodeURIComponent(bookingId)
        }/end`,

    conference: (bookingId) =>
        `${domain}/api/doctor/consultations/${
            encodeURIComponent(bookingId)
        }/conference-credentials`
};

/* ---------------- Helper functions ---------------- */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

const token = () =>
    localStorage.getItem("token") || "";

const authHeaders = (json = false) => ({
    Authorization: `Bearer ${token()}`,

    ...(json
        ? {
            "Content-Type": "application/json"
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
    const type =
        response.headers.get("content-type") || "";

    if (!type.includes("application/json")) {
        throw new Error(
            "The server returned an invalid response."
        );
    }

    return response.json();
};

const extractArray = (data, keys) => {
    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data?.data)) {
        return data.data;
    }

    for (const key of keys) {
        if (Array.isArray(data?.[key])) {
            return data[key];
        }

        if (Array.isArray(data?.data?.[key])) {
            return data.data[key];
        }
    }

    return [];
};

const setMessage = (
    element,
    text,
    state = ""
) => {
    element.textContent = text;

    element.className =
        `message${state ? ` ${state}` : ""}`;
};

/*
 * Returns today's date in the user's local timezone
 * in YYYY-MM-DD format.
 *
 * Do not use toISOString() here because it converts
 * the date and time to UTC.
 */
const getTodayDate = () => {
    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth() + 1).padStart(2, "0");

    const day =
        String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
    if (!value) {
        return "Date not provided";
    }

    const date = new Date(
        `${String(value).slice(0, 10)}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

/* ---------------- Element references ---------------- */

const tabContainer =
    $(".tabs-container");

const panels =
    $$(".tabs_panel > section");

const todayResults =
    $("#todayResults");

const consultationMessage =
    $("#consultationMessage");

/* ---------------- Tab switching ---------------- */

const openTab = (id) => {
    panels.forEach((panel) => {
        panel.hidden =
            panel.id !== id;
    });

    $$("a", tabContainer).forEach((link) => {
        const active =
            link.getAttribute("href") === `#${id}`;

        link.classList.toggle(
            "active-tab",
            active
        );

        link.setAttribute(
            "aria-selected",
            String(active)
        );
    });

    if (id === "consultations") {
        loadTodayConsultations();
    }
};

tabContainer.addEventListener(
    "click",
    (event) => {
        const link =
            event.target.closest("a");

        if (!link) {
            return;
        }

        event.preventDefault();

        openTab(
            link.getAttribute("href").slice(1)
        );
    }
);

/* ---------------- Consultation buttons ---------------- */

const consultationActions = (booking) => {
    const id =
        booking.bookingID ||
        booking.id ||
        booking._id;

    const status = String(
        booking.status || ""
    ).toUpperCase();

    const type = String(
        booking.consultationType || "OFFLINE"
    ).toUpperCase();

    /*
     * Waiting-list consultation
     */
    if (
        status === "WAITING" ||
        status === "WAITLISTED"
    ) {
        return `
            <button
                class="remove-wl"
                type="button"
                data-action="remove-waiting"
                data-booking-id="${escapeHTML(id)}"
            >
                Remove from Waiting List
            </button>
        `;
    }

    /*
     * Confirmed consultation:
     * doctor can start it.
     */
    if (
        status === "CONFIRMED" ||
        status === "BOOKED"
    ) {
        return `
            <button
                class="start-consultation"
                type="button"
                data-action="start"
                data-booking-id="${escapeHTML(id)}"
            >
                Start Consultation
            </button>
        `;
    }

    /*
     * Active consultation:
     * doctor can join an online conference
     * and end the consultation.
     */
    if (status === "CONSULTING") {
        return `
            ${
                type === "ONLINE"
                    ? `
                        <button
                            class="join-conference"
                            type="button"
                            data-action="join"
                            data-booking-id="${escapeHTML(id)}"
                        >
                            Join Conference
                        </button>
                    `
                    : ""
            }

            <button
                class="end-consultation"
                type="button"
                data-action="end"
                data-booking-id="${escapeHTML(id)}"
            >
                End Consultation
            </button>
        `;
    }

    /*
     * No buttons for DONE or CANCELLED consultations.
     */
    return "";
};

/* ---------------- Consultation card ---------------- */

const consultationCard = (booking) => {
    const status = String(
        booking.status || "UNKNOWN"
    ).toUpperCase();

    return `
        <article class="card">
            <div class="card-content">
                <h2>
                    ${escapeHTML(
                        booking.patientName ||
                        booking.patient?.name ||
                        "Patient"
                    )}
                </h2>

                <div class="booking-meta">
                    <span>
                        ${escapeHTML(
                            booking.slot ||
                            booking.shift ||
                            "Slot not provided"
                        )}
                    </span>

                    <span>
                        Token:
                        ${escapeHTML(
                            booking.tokenNumber ??
                            booking.token ??
                            "Not assigned"
                        )}
                    </span>

                    <span>
                        ${escapeHTML(
                            booking.consultationType ||
                            "OFFLINE"
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
                        formatDate(
                            booking.date ||
                            booking.bookingDate
                        )
                    )}
                </p>

                ${
                    booking.reason
                        ? `
                            <p class="feedback">
                                ${escapeHTML(
                                    booking.reason
                                )}
                            </p>
                        `
                        : ""
                }
            </div>

            <div class="card-actions">
                ${consultationActions(booking)}
            </div>
        </article>
    `;
};

const renderConsultations = (
    container,
    consultations
) => {
    container.innerHTML = consultations.length
        ? consultations
            .map(consultationCard)
            .join("")
        : `
            <div class="empty-state">
                <h2>No consultations found</h2>

                <p>
                    Consultations will appear here.
                </p>
            </div>
        `;
};

/* ---------------- Load today's consultations ---------------- */

const loadTodayConsultations = async () => {
    const refreshButton =
        $("#refreshConsultations");

    refreshButton.disabled = true;

    refreshButton.textContent =
        "Loading...";

    setMessage(
        consultationMessage,
        "Loading today's consultations..."
    );

    try {
        const today =
            getTodayDate();

        const response = await fetch(
            `${ENDPOINTS.today}?date=${
                encodeURIComponent(today)
            }`,
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
                "Unable to load today's consultations."
            );
        }

        const consultations = extractArray(
            data,
            ["consultations", "bookings"]
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

/* ---------------- Emergency cancellation ---------------- */

$("#emergencyCancel").addEventListener(
    "click",
    async () => {
        const today =
            getTodayDate();

        const confirmed =
            globalThis.confirm(
                `Cancel all remaining appointments for ${today}? ` +
                "This emergency action cannot be undone."
            );

        if (!confirmed) {
            return;
        }

        const button =
            $("#emergencyCancel");

        button.disabled = true;

        button.textContent =
            "Cancelling...";

        setMessage(
            consultationMessage,
            "Cancelling today's remaining appointments..."
        );

        try {
            const response = await fetch(
                ENDPOINTS.emergencyCancel,
                {
                    method: "PATCH",

                    headers:
                        authHeaders(true),

                    body: JSON.stringify({
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

            setMessage(
                consultationMessage,
                data.message ||
                "Today's remaining appointments were cancelled.",
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

/* ---------------- Consultation action handling ---------------- */

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

        if (action === "remove-waiting") {
            setMessage(
                consultationMessage,
                "Connect this button to your existing waiting-list removal endpoint.",
                "error"
            );

            return;
        }

        const isStarting =
            action === "start";

        const endpoint = isStarting
            ? ENDPOINTS.start(bookingId)
            : ENDPOINTS.end(bookingId);

        const nextStatus = isStarting
            ? "CONSULTING"
            : "DONE";

        button.disabled = true;

        button.textContent = isStarting
            ? "Starting..."
            : "Ending...";

        try {
            const response = await fetch(
                endpoint,
                {
                    method: "PATCH",

                    headers:
                        authHeaders(true),

                    body: JSON.stringify({
                        status: nextStatus
                    })
                }
            );

            const data =
                await readJSON(response);

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Unable to mark consultation as ${nextStatus}.`
                );
            }

            setMessage(
                consultationMessage,
                data.message ||
                `Consultation status updated to ${nextStatus}.`,
                "success"
            );

            /*
             * Reload the cards so that:
             *
             * CONFIRMED -> CONSULTING
             * Start button -> End button
             *
             * or:
             *
             * CONSULTING -> DONE
             * End button -> no action button
             */
            await loadTodayConsultations();
        } catch (error) {
            setMessage(
                consultationMessage,
                error.message,
                "error"
            );

            button.disabled = false;

            button.textContent = isStarting
                ? "Start Consultation"
                : "End Consultation";
        }
    }
);

/* ---------------- Join online conference ---------------- */

const joinConference = async (
    bookingId,
    button
) => {
    button.disabled = true;

    button.textContent =
        "Joining...";

    try {
        const response = await fetch(
            ENDPOINTS.conference(bookingId),
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
                "Unable to fetch conference credentials."
            );
        }

        const credentials =
            data.data || data;

        const channel =
            credentials.channel ||
            credentials.channelName;

        const conferenceToken =
            credentials.token ||
            credentials.rtcToken;

        if (!channel || !conferenceToken) {
            throw new Error(
                "The backend did not return a channel and token."
            );
        }

        sessionStorage.setItem(
            "conferenceChannel",
            channel
        );

        sessionStorage.setItem(
            "conferenceToken",
            conferenceToken
        );

        sessionStorage.setItem(
            "currentConsultationBookingId",
            bookingId
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
            "Join Conference";
    }
};

/* ---------------- Search consultations ---------------- */

$("#searchForm").addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const button =
            $("#search");

        const date =
            $("#date").value.trim();

        button.disabled = true;

        button.textContent =
            "Searching...";

        setMessage(
            $("#searchMessage"),
            "Searching consultations..."
        );

        try {
            const response = await fetch(
                `${ENDPOINTS.search}/date?=${date}`,
                {
                    method: "POST",

                    headers:
                        authHeaders(true),
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
                $("#searchResults"),
                consultations
            );

            setMessage(
                $("#searchMessage"),
                `${consultations.length} result(s).`,
                "success"
            );
        } catch (error) {
            setMessage(
                $("#searchMessage"),
                error.message,
                "error"
            );
        } finally {
            button.disabled = false;

            button.textContent =
                "Search";
        }
    }
);

/* ---------------- Update availability ---------------- */

$("#availabilityForm").addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const button =
            $("#updateAvailability");

        const body = {
            date:
                $("#availabilityDate").value,

            morningCapacity:
                Number(
                    $("#morningCapacity").value
                ),

            afternoonCapacity:
                Number(
                    $("#afternoonCapacity").value
                ),

            eveningCapacity:
                Number(
                    $("#eveningCapacity").value
                )
        };

        button.disabled = true;

        button.textContent =
            "Updating...";

        try {
            const response = await fetch(
                ENDPOINTS.availability,
                {
                    method: "PUT",

                    headers:
                        authHeaders(true),

                    body:
                        JSON.stringify(body)
                }
            );

            const data =
                await readJSON(response);

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to update availability."
                );
            }

            setMessage(
                $("#availabilityMessage"),
                data.message ||
                "Availability updated successfully.",
                "success"
            );
        } catch (error) {
            setMessage(
                $("#availabilityMessage"),
                error.message,
                "error"
            );
        } finally {
            button.disabled = false;

            button.textContent =
                "Update Availability";
        }
    }
);

/* ---------------- Initial page setup ---------------- */

$("#availabilityDate").min =
    getTodayDate();

$("#availabilityDate").value =
    getTodayDate();

openTab("find");