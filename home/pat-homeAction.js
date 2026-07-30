import { domain } from "../config.js";

/* =========================================================
   API ENDPOINTS

   Change only these paths if your backend routes are different.
========================================================= */

const ENDPOINTS = {
    findDoctor:
        `${domain}/api/find-doctor`,

    bookDoctor:
        `${domain}/api/book-doctor`,

    upcoming:
        `${domain}/api/patient/consultations/upcoming`,

    past:
        `${domain}/api/patient/bookings/past`,

    reports:
        `${domain}/api/patient/reports`,

    feedback: (bookingId) =>
        `${domain}/api/patient/bookings/${
            encodeURIComponent(bookingId)
        }/feedback`,

    conference: (bookingId) =>
        `${domain}/api/patient/consultations/${
            encodeURIComponent(bookingId)
        }/conference-credentials`
};

/* =========================================================
   CONSTANTS
========================================================= */

const BLACK_STAR =
    "../media/bstar.png";

const YELLOW_STAR =
    "../media/ystar.png";

/*
 * Stores the doctor and slot selected by the patient
 * before the booking request is submitted.
 */
let selectedBooking = null;

/* =========================================================
   GENERAL HELPER FUNCTIONS
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
        response.headers.get(
            "content-type"
        ) || "";

    if (
        !contentType.includes(
            "application/json"
        )
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

    if (
        Array.isArray(
            responseData?.data
        )
    ) {
        return responseData.data;
    }

    for (const key of possibleKeys) {
        if (
            Array.isArray(
                responseData?.[key]
            )
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
    text,
    state = ""
) => {
    if (!element) {
        return;
    }

    element.textContent = text;

    element.className =
        `message${
            state ? ` ${state}` : ""
        }`;
};

const getTodayDate = () => {
    const today =
        new Date();

    const year =
        today.getFullYear();

    const month =
        String(
            today.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            today.getDate()
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
        new Date(
            `${dateValue}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
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

const formatPrice = (price) => {
    const number =
        Number(price);

    if (
        !Number.isFinite(number)
    ) {
        return "Fee not provided";
    }

    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }
    ).format(number);
};

/* =========================================================
   TAB SWITCHING
========================================================= */

const tabContainer =
    $(".tabs-container");

const panels =
    $$(".tabs_panel > section");

const openTab = (panelId) => {
    panels.forEach((panel) => {
        panel.hidden =
            panel.id !== panelId;
    });

    $$("a", tabContainer)
        .forEach((link) => {
            const isActive =
                link.getAttribute("href") ===
                `#${panelId}`;

            link.classList.toggle(
                "active",
                isActive
            );

            link.setAttribute(
                "aria-selected",
                String(isActive)
            );
        });

    if (
        panelId ===
        "consultations"
    ) {
        loadUpcomingConsultations();
    }

    if (
        panelId === "bookings"
    ) {
        loadPastBookings();
    }

    if (
        panelId === "reports"
    ) {
        loadReports();
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

        const href =
            link.getAttribute("href");

        if (
            !href ||
            !href.startsWith("#")
        ) {
            return;
        }

        event.preventDefault();

        openTab(
            href.slice(1)
        );
    }
);

/* =========================================================
   DOCTOR SEARCH HELPERS
========================================================= */

const getAvailability = (
    availability
) => {
    const capacity =
        Number(
            availability.capacity ??
            availability.totalCapacity ??
            0
        );

    const bookings =
        Number(
            availability.bookings ??
            availability.totalBookings ??
            0
        );

    const explicitlyAvailable =
        availability.available ??
        availability.availableSeats ??
        availability.remainingCapacity;

    if (
        explicitlyAvailable !==
        undefined
    ) {
        return Number(
            explicitlyAvailable
        );
    }

    return capacity - bookings;
};

const getAvailabilityStatus = (
    availability
) => {
    const remaining =
        getAvailability(
            availability
        );

    return remaining > 0
        ? `${remaining} available`
        : "Waiting list";
};

const availabilityButton = (
    doctor,
    availability
) => {
    const doctorId =
        doctor.id ||
        doctor._id ||
        doctor.docID ||
        doctor.doctorID;

    const date =
        availability.date ||
        availability.bookingDate ||
        "";

    const slot =
        String(
            availability.slot ||
            availability.shift ||
            ""
        ).toUpperCase();

    const remaining =
        getAvailability(
            availability
        );

    const availabilityText =
        getAvailabilityStatus(
            availability
        );

    return `
        <button
            class="slot-button ${
                remaining > 0
                    ? "available-slot"
                    : "waiting-slot"
            }"
            type="button"
            data-action="select-slot"
            data-doctor-id="${
                escapeHTML(doctorId)
            }"
            data-doctor-name="${
                escapeHTML(
                    doctor.name ||
                    doctor.doctorName ||
                    "Doctor"
                )
            }"
            data-date="${
                escapeHTML(date)
            }"
            data-slot="${
                escapeHTML(slot)
            }"
            data-availability="${
                escapeHTML(
                    availabilityText
                )
            }"
            data-is-waiting="${
                remaining <= 0
            }"
        >
            <strong>
                ${escapeHTML(slot)}
            </strong>

            <span>
                ${
                    escapeHTML(
                        availabilityText
                    )
                }
            </span>
        </button>
    `;
};

const getDoctorRating = (
    doctor
) => {
    const value =
        Number(
            doctor.rating ??
            doctor.averageRating ??
            0
        );

    return Math.max(
        0,
        Math.min(5, value)
    );
};

const doctorCard = (doctor) => {
    const specialities = [
        doctor.speciality,
        doctor.speciality1,
        doctor.speciality2,
        doctor.speciality3
    ].filter(Boolean);

    const location = [
        doctor.facilityName,
        doctor.city,
        doctor.state,
        doctor.country
    ].filter(Boolean).join(", ");

    const availability =
        doctor.availability ||
        doctor.availablity ||
        doctor.slots ||
        [];

    const rating =
        getDoctorRating(doctor);

    return `
        <article class="doctor-card">
            <div class="doctor-summary">
                ${
                    doctor.photo ||
                    doctor.imageUrl
                        ? `
                            <img
                                class="doctor-photo"
                                src="${
                                    escapeHTML(
                                        doctor.photo ||
                                        doctor.imageUrl
                                    )
                                }"
                                alt="${
                                    escapeHTML(
                                        doctor.name ||
                                        doctor.doctorName ||
                                        "Doctor"
                                    )
                                }"
                            >
                        `
                        : `
                            <div
                                class="doctor-photo doctor-photo-placeholder"
                                aria-hidden="true"
                            >
                                +
                            </div>
                        `
                }

                <div class="doctor-information">
                    <h2>
                        ${
                            escapeHTML(
                                doctor.name ||
                                doctor.doctorName ||
                                "Doctor"
                            )
                        }
                    </h2>

                    <p class="doctor-speciality">
                        ${
                            escapeHTML(
                                specialities.join(", ") ||
                                "Speciality not provided"
                            )
                        }
                    </p>

                    <p class="doctor-location">
                        ${
                            escapeHTML(
                                location ||
                                "Location not provided"
                            )
                        }
                    </p>

                    <div class="doctor-numbers">
                        <span>
                            ${
                                escapeHTML(
                                    formatPrice(
                                        doctor.consultationFee ??
                                        doctor.fee
                                    )
                                )
                            }
                        </span>

                        <span>
                            Rating:
                            ${
                                escapeHTML(
                                    rating.toFixed(1)
                                )
                            }/5
                        </span>
                    </div>

                    ${
                        doctor.about
                            ? `
                                <p class="doctor-about">
                                    ${
                                        escapeHTML(
                                            doctor.about
                                        )
                                    }
                                </p>
                            `
                            : ""
                    }
                </div>
            </div>

            <div class="doctor-availability">
                ${
                    availability.length
                        ? availability
                            .map((item) =>
                                availabilityButton(
                                    doctor,
                                    item
                                )
                            )
                            .join("")
                        : `
                            <p class="no-slots">
                                No availability was returned for this doctor.
                            </p>
                        `
                }
            </div>
        </article>
    `;
};

const renderDoctors = (
    doctors
) => {
    const searchResults =
        $("#searchResults");

    if (!doctors.length) {
        searchResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    +
                </div>

                <h2>
                    No doctors found
                </h2>

                <p>
                    Try changing your location,
                    price or rating filters.
                </p>
            </div>
        `;

        return;
    }

    searchResults.innerHTML =
        doctors
            .map(doctorCard)
            .join("");
};

/* =========================================================
   SEARCH DOCTORS

   The slot filter has been removed.

   New filters:
   - minPrice
   - maxPrice
   - minRating
========================================================= */

$("#signinForm").addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const searchButton =
            $("#search");

        const errorElement =
            $("#err");

        errorElement.textContent =
            "";

        const minPriceText =
            $("#minPrice").value.trim();

        const maxPriceText =
            $("#maxPrice").value.trim();

        const minRatingText =
            $("#minRating").value;

        const filters = {
            city:
                $("#city").value.trim(),

            speciality:
                $("#speciality")
                    .value
                    .trim(),

            facility:
                $("#facility")
                    .value
                    .trim(),

            name:
                $("#name").value.trim(),

            date:
                $("#date").value,

            minPrice:
                minPriceText === ""
                    ? null
                    : Number(
                        minPriceText
                    ),

            maxPrice:
                maxPriceText === ""
                    ? null
                    : Number(
                        maxPriceText
                    ),

            minRating:
                minRatingText === ""
                    ? null
                    : Number(
                        minRatingText
                    )
        };

        if (
            filters.minPrice !== null &&
            filters.minPrice < 0
        ) {
            errorElement.textContent =
                "Minimum price cannot be negative.";

            return;
        }

        if (
            filters.maxPrice !== null &&
            filters.maxPrice < 0
        ) {
            errorElement.textContent =
                "Maximum price cannot be negative.";

            return;
        }

        if (
            filters.minPrice !== null &&
            filters.maxPrice !== null &&
            filters.minPrice >
                filters.maxPrice
        ) {
            errorElement.textContent =
                "Minimum price cannot be greater than maximum price.";

            return;
        }

        searchButton.disabled =
            true;

        searchButton.textContent =
            "Searching...";

        try {
            const response =
                await fetch(
                    ENDPOINTS.findDoctor,
                    {
                        method: "POST",

                        headers:
                            authHeaders(true),

                        body:
                            JSON.stringify(
                                filters
                            )
                    }
                );

            const data =
                await readJSON(
                    response
                );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to search for doctors."
                );
            }

            const doctors =
                extractArray(
                    data,
                    [
                        "doctors",
                        "results"
                    ]
                );

            renderDoctors(doctors);
        } catch (error) {
            errorElement.textContent =
                error.message;
        } finally {
            searchButton.disabled =
                false;

            searchButton.textContent =
                "Search Doctors";
        }
    }
);

/* =========================================================
   BOOKING DIALOG
========================================================= */

const bookingDialog =
    $("#bookingDialog");

const closeBookingDialog = () => {
    selectedBooking = null;

    $("#bookingForm").reset();

    $("#bookingError").textContent =
        "";

    if (bookingDialog.open) {
        bookingDialog.close();
    }
};

const openBookingDialog = (
    button
) => {
    selectedBooking = {
        doctorId:
            button.dataset.doctorId,

        doctorName:
            button.dataset.doctorName,

        date:
            button.dataset.date,

        slot:
            button.dataset.slot,

        availability:
            button.dataset.availability,

        isWaiting:
            button.dataset.isWaiting ===
            "true"
    };

    $("#selectedDoctor").textContent =
        selectedBooking.doctorName;

    $("#selectedDate").textContent =
        formatDate(
            selectedBooking.date
        );

    $("#selectedShift").textContent =
        selectedBooking.slot;

    $("#selectedAvailability")
        .textContent =
            selectedBooking.availability;

    $("#bookingError").textContent =
        "";

    bookingDialog.showModal();
};

$("#searchResults").addEventListener(
    "click",
    (event) => {
        const button =
            event.target.closest(
                "button[data-action='select-slot']"
            );

        if (!button) {
            return;
        }

        openBookingDialog(button);
    }
);

$("#closeBookingDialog")
    .addEventListener(
        "click",
        closeBookingDialog
    );

$("#cancelBooking")
    .addEventListener(
        "click",
        closeBookingDialog
    );

bookingDialog.addEventListener(
    "click",
    (event) => {
        /*
         * Close the dialog when the patient
         * clicks outside the form.
         */
        if (
            event.target ===
            bookingDialog
        ) {
            closeBookingDialog();
        }
    }
);

/* =========================================================
   CONFIRM BOOKING
========================================================= */

$("#bookingForm").addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const errorElement =
            $("#bookingError");

        const confirmButton =
            $("#confirmBooking");

        errorElement.textContent =
            "";

        if (!selectedBooking) {
            errorElement.textContent =
                "Please select a doctor and slot.";

            return;
        }

        const selectedType =
            $(
                "input[name='consultationType']:checked",
                event.currentTarget
            );

        if (!selectedType) {
            errorElement.textContent =
                "Please select a consultation type.";

            return;
        }

        const requestBody = {
            doctorId:
                selectedBooking.doctorId,

            date:
                selectedBooking.date,

            slot:
                selectedBooking.slot,

            consultationType:
                selectedType.value,

            /*
             * This tells the backend whether the
             * slot was already full when selected.
             */
            waitingList:
                selectedBooking.isWaiting
        };

        confirmButton.disabled =
            true;

        confirmButton.textContent =
            "Booking...";

        try {
            const response =
                await fetch(
                    ENDPOINTS.bookDoctor,
                    {
                        method: "POST",

                        headers:
                            authHeaders(true),

                        body:
                            JSON.stringify(
                                requestBody
                            )
                    }
                );

            const data =
                await readJSON(
                    response
                );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to book the consultation."
                );
            }

            closeBookingDialog();

            globalThis.alert(
                data.message ||
                (
                    requestBody.waitingList
                        ? "You were added to the waiting list."
                        : "Consultation booked successfully."
                )
            );

            openTab(
                "consultations"
            );
        } catch (error) {
            errorElement.textContent =
                error.message;
        } finally {
            confirmButton.disabled =
                false;

            confirmButton.textContent =
                "Confirm Booking";
        }
    }
);

/* =========================================================
   STAR RATING FUNCTIONS
========================================================= */

const ratingStars = (
    rating,
    interactive = false
) => {
    const selectedRating =
        Math.max(
            0,
            Math.min(
                5,
                Number(rating) || 0
            )
        );

    return Array.from(
        { length: 5 },
        (_, index) => {
            const starNumber =
                index + 1;

            const source =
                starNumber <=
                selectedRating
                    ? YELLOW_STAR
                    : BLACK_STAR;

            if (!interactive) {
                return `
                    <img
                        src="${source}"
                        alt=""
                        aria-hidden="true"
                    >
                `;
            }

            return `
                <button
                    class="star-button"
                    type="button"
                    data-rating="${
                        starNumber
                    }"
                    aria-label="Give ${
                        starNumber
                    } star${
                        starNumber === 1
                            ? ""
                            : "s"
                    }"
                    aria-pressed="false"
                >
                    <img
                        src="${source}"
                        alt=""
                        aria-hidden="true"
                    >
                </button>
            `;
        }
    ).join("");
};

const feedbackContent = (
    booking,
    bookingId
) => {
    /*
     * Show Give Feedback only when BOTH
     * feedback and rating are null.
     */
    const feedbackIsEmpty =
        booking.feedback == null &&
        booking.rating == null;

    if (feedbackIsEmpty) {
        return `
            <div class="feedback-section">
                <button
                    class="give-feedback"
                    type="button"
                    data-booking-id="${
                        escapeHTML(
                            bookingId
                        )
                    }"
                >
                    Give Feedback
                </button>
            </div>
        `;
    }

    const rating =
        Math.max(
            0,
            Math.min(
                5,
                Number(
                    booking.rating
                ) || 0
            )
        );

    return `
        <div
            class="feedback-section existing-feedback"
        >
            <h3>
                Your feedback
            </h3>

            <div
                class="rating-display"
                aria-label="${
                    rating
                } out of 5 stars"
            >
                ${ratingStars(rating)}

                <span class="rating-number">
                    ${rating}/5
                </span>
            </div>

            <p>
                ${
                    escapeHTML(
                        booking.feedback ||
                        "No written feedback was provided."
                    )
                }
            </p>
        </div>
    `;
};

/* =========================================================
   UPCOMING AND PAST BOOKING CARDS
========================================================= */

const bookingCard = (
    booking,
    upcoming = false
) => {
    const bookingId =
        booking.id ||
        booking._id ||
        booking.bookingID;

    const consultationType =
        String(
            booking.consultationType ||
            booking.type ||
            "OFFLINE"
        ).toUpperCase();

    const status =
        String(
            booking.status ||
            "UNKNOWN"
        ).toUpperCase();

    const canJoin =
        upcoming &&
        consultationType ===
            "ONLINE" &&
        (
            status === "CONFIRMED" ||
            status === "CONSULTING"
        );

    const feedback =
        upcoming
            ? ""
            : feedbackContent(
                booking,
                bookingId
            );

    return `
        <article
            class="booking-card ${
                upcoming
                    ? ""
                    : "has-feedback"
            }"
            data-booking-id="${
                escapeHTML(
                    bookingId
                )
            }"
        >
            <div class="booking-content">
                <h2>
                    ${
                        escapeHTML(
                            booking.doctorName ||
                            booking.docName ||
                            booking.doctor?.name ||
                            "Doctor"
                        )
                    }
                </h2>

                <div class="booking-meta">
                    <span>
                        Date:
                        ${
                            escapeHTML(
                                formatDate(
                                    booking.date ||
                                    booking.bookingDate
                                )
                            )
                        }
                    </span>

                    <span>
                        Slot:
                        ${
                            escapeHTML(
                                booking.slot ||
                                booking.shift ||
                                "Not provided"
                            )
                        }
                    </span>

                    <span>
                        Token:
                        ${
                            escapeHTML(
                                booking.token ??
                                booking.tokenNumber ??
                                "Not assigned"
                            )
                        }
                    </span>

                    <span>
                        Status:
                        ${
                            escapeHTML(
                                status
                            )
                        }
                    </span>

                    <span class="consultation-badge">
                        ${
                            escapeHTML(
                                consultationType
                            )
                        }
                    </span>
                </div>

                ${
                    booking.facilityName
                        ? `
                            <p>
                                ${
                                    escapeHTML(
                                        booking.facilityName
                                    )
                                }
                            </p>
                        `
                        : ""
                }
            </div>

            ${
                canJoin
                    ? `
                        <div class="card-actions">
                            <button
                                class="join-conference"
                                type="button"
                                data-booking-id="${
                                    escapeHTML(
                                        bookingId
                                    )
                                }"
                            >
                                Join Conference
                            </button>
                        </div>
                    `
                    : ""
            }

            ${feedback}
        </article>
    `;
};

const renderBookings = (
    container,
    bookings,
    upcoming
) => {
    if (!bookings.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    +
                </div>

                <h2>
                    ${
                        upcoming
                            ? "No upcoming consultations"
                            : "No past bookings"
                    }
                </h2>

                <p>
                    ${
                        upcoming
                            ? "Your upcoming appointments will appear here."
                            : "Your completed bookings will appear here."
                    }
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        bookings
            .map((booking) =>
                bookingCard(
                    booking,
                    upcoming
                )
            )
            .join("");
};

/* =========================================================
   LOAD UPCOMING CONSULTATIONS
========================================================= */

const loadUpcomingConsultations =
    async () => {
        const results =
            $("#consultationResults");

        const message =
            $("#consultationMessage");

        const refreshButton =
            $("#refreshConsultations");

        refreshButton.disabled =
            true;

        refreshButton.textContent =
            "Loading...";

        setMessage(
            message,
            "Loading upcoming consultations..."
        );

        try {
            const response =
                await fetch(
                    ENDPOINTS.upcoming,
                    {
                        method: "GET",
                        headers:
                            authHeaders()
                    }
                );

            const data =
                await readJSON(
                    response
                );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to load upcoming consultations."
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

            renderBookings(
                results,
                consultations,
                true
            );

            setMessage(
                message,
                `${consultations.length} upcoming consultation(s).`,
                "success"
            );
        } catch (error) {
            setMessage(
                message,
                error.message,
                "error"
            );
        } finally {
            refreshButton.disabled =
                false;

            refreshButton.textContent =
                "Refresh";
        }
    };

$("#refreshConsultations")
    .addEventListener(
        "click",
        loadUpcomingConsultations
    );

/* =========================================================
   LOAD PAST BOOKINGS
========================================================= */

const loadPastBookings =
    async () => {
        const results =
            $("#pastBookingResults");

        const message =
            $("#bookingHistoryMessage");

        setMessage(
            message,
            "Loading past bookings..."
        );

        try {
            const response =
                await fetch(
                    ENDPOINTS.past,
                    {
                        method: "GET",
                        headers:
                            authHeaders()
                    }
                );

            const data =
                await readJSON(
                    response
                );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to load past bookings."
                );
            }

            const bookings =
                extractArray(
                    data,
                    [
                        "bookings",
                        "consultations"
                    ]
                );

            renderBookings(
                results,
                bookings,
                false
            );

            setMessage(
                message,
                `${bookings.length} past booking(s).`,
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
   OPEN AND UPDATE FEEDBACK FORM
========================================================= */

const pastBookingResults =
    $("#pastBookingResults");

const openFeedbackForm = (
    bookingId,
    bookingCardElement
) => {
    const feedbackSection =
        $(
            ".feedback-section",
            bookingCardElement
        );

    feedbackSection.innerHTML = `
        <form
            class="feedback-form"
            data-booking-id="${
                escapeHTML(
                    bookingId
                )
            }"
        >
            <label>
                Your feedback

                <textarea
                    name="feedback"
                    maxlength="1000"
                    placeholder="Describe your experience with the doctor..."
                    required
                ></textarea>
            </label>

            <div>
                <p class="rating-label">
                    Select rating
                </p>

                <div
                    class="rating-selector"
                    data-selected-rating="0"
                    role="group"
                    aria-label="Select a rating"
                >
                    ${
                        ratingStars(
                            0,
                            true
                        )
                    }
                </div>
            </div>

            <p
                class="feedback-form-message message"
                aria-live="polite"
            ></p>

            <div class="feedback-actions">
                <button
                    class="cancel-feedback"
                    type="button"
                >
                    Cancel
                </button>

                <button
                    class="submit-feedback"
                    type="submit"
                >
                    Submit Feedback
                </button>
            </div>
        </form>
    `;

    $(
        "textarea",
        feedbackSection
    ).focus();
};

const updateSelectedStars = (
    ratingSelector,
    selectedRating
) => {
    ratingSelector.dataset
        .selectedRating =
            String(
                selectedRating
            );

    $$(
        ".star-button",
        ratingSelector
    ).forEach((button) => {
        const starNumber =
            Number(
                button.dataset.rating
            );

        const isSelected =
            starNumber <=
            selectedRating;

        const image =
            $("img", button);

        image.src =
            isSelected
                ? YELLOW_STAR
                : BLACK_STAR;

        button.setAttribute(
            "aria-pressed",
            String(isSelected)
        );
    });
};

/* =========================================================
   FEEDBACK CLICK HANDLING
========================================================= */

pastBookingResults.addEventListener(
    "click",
    (event) => {
        const giveFeedbackButton =
            event.target.closest(
                ".give-feedback"
            );

        if (giveFeedbackButton) {
            const bookingId =
                giveFeedbackButton
                    .dataset
                    .bookingId;

            const bookingCardElement =
                giveFeedbackButton.closest(
                    ".booking-card"
                );

            openFeedbackForm(
                bookingId,
                bookingCardElement
            );

            return;
        }

        const starButton =
            event.target.closest(
                ".star-button"
            );

        if (starButton) {
            const ratingSelector =
                starButton.closest(
                    ".rating-selector"
                );

            const selectedRating =
                Number(
                    starButton
                        .dataset
                        .rating
                );

            updateSelectedStars(
                ratingSelector,
                selectedRating
            );

            return;
        }

        const cancelButton =
            event.target.closest(
                ".cancel-feedback"
            );

        if (cancelButton) {
            loadPastBookings();
        }
    }
);

/* =========================================================
   SUBMIT FEEDBACK
========================================================= */

pastBookingResults.addEventListener(
    "submit",
    async (event) => {
        const form =
            event.target.closest(
                ".feedback-form"
            );

        if (!form) {
            return;
        }

        event.preventDefault();

        const bookingId =
            form.dataset.bookingId;

        const feedback =
            $(
                "textarea[name='feedback']",
                form
            ).value.trim();

        const ratingSelector =
            $(
                ".rating-selector",
                form
            );

        const rating =
            Number(
                ratingSelector
                    .dataset
                    .selectedRating
            );

        const message =
            $(
                ".feedback-form-message",
                form
            );

        const submitButton =
            $(
                ".submit-feedback",
                form
            );

        if (!feedback) {
            setMessage(
                message,
                "Please enter your feedback.",
                "error"
            );

            return;
        }

        if (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {
            setMessage(
                message,
                "Please select a rating from 1 to 5 stars.",
                "error"
            );

            return;
        }

        submitButton.disabled =
            true;

        submitButton.textContent =
            "Submitting...";

        setMessage(
            message,
            "Submitting your feedback..."
        );

        try {
            const response =
                await fetch(
                    ENDPOINTS.feedback(
                        bookingId
                    ),
                    {
                        method: "PATCH",

                        headers:
                            authHeaders(true),

                        body:
                            JSON.stringify({
                                feedback,
                                rating
                            })
                    }
                );

            const data =
                await readJSON(
                    response
                );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to submit feedback."
                );
            }

            setMessage(
                $("#bookingHistoryMessage"),
                data.message ||
                "Feedback submitted successfully.",
                "success"
            );

            /*
             * Reloading replaces the feedback form
             * with the saved feedback and stars.
             */
            await loadPastBookings();
        } catch (error) {
            setMessage(
                message,
                error.message,
                "error"
            );

            submitButton.disabled =
                false;

            submitButton.textContent =
                "Submit Feedback";
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
    button.disabled =
        true;

    button.textContent =
        "Joining...";

    try {
        const response =
            await fetch(
                ENDPOINTS.conference(
                    bookingId
                ),
                {
                    method: "GET",
                    headers:
                        authHeaders()
                }
            );

        const data =
            await readJSON(
                response
            );

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

        if (
            !channel ||
            !conferenceToken
        ) {
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
            $("#consultationMessage"),
            error.message,
            "error"
        );

        button.disabled =
            false;

        button.textContent =
            "Join Conference";
    }
};

$("#consultationResults")
    .addEventListener(
        "click",
        async (event) => {
            const button =
                event.target.closest(
                    ".join-conference"
                );

            if (!button) {
                return;
            }

            const bookingId =
                button.dataset.bookingId;

            if (!bookingId) {
                setMessage(
                    $("#consultationMessage"),
                    "Booking ID is missing.",
                    "error"
                );

                return;
            }

            await joinConference(
                bookingId,
                button
            );
        }
    );

/* =========================================================
   REPORT CARDS
========================================================= */

const reportCard = (report) => {
    const fileUrl =
        report.fileUrl ||
        report.url ||
        "#";

    const fileType =
        String(
            report.fileType ||
            "FILE"
        ).toUpperCase();

    return `
        <article class="report-card">
            <div class="report-information">
                <h2>
                    ${
                        escapeHTML(
                            report.title ||
                            "Medical Report"
                        )
                    }
                </h2>

                <div class="booking-meta">
                    <span>
                        Category:
                        ${
                            escapeHTML(
                                report.category ||
                                "OTHER"
                            )
                        }
                    </span>

                    <span>
                        Type:
                        ${
                            escapeHTML(
                                fileType
                            )
                        }
                    </span>

                    <span>
                        Uploaded:
                        ${
                            escapeHTML(
                                formatDate(
                                    report.createdAt ||
                                    report.uploadedAt
                                )
                            )
                        }
                    </span>

                    <span>
                        Uploaded by:
                        ${
                            escapeHTML(
                                report.uploadedBy ||
                                "Not provided"
                            )
                        }
                    </span>
                </div>
            </div>

            <div class="card-actions">
                <a
                    class="report-open-button"
                    href="${
                        escapeHTML(
                            fileUrl
                        )
                    }"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Open Report
                </a>
            </div>
        </article>
    `;
};

/* =========================================================
   LOAD REPORTS
========================================================= */

const loadReports =
    async () => {
        const results =
            $("#reportResults");

        const message =
            $("#reportMessage");

        setMessage(
            message,
            "Loading reports..."
        );

        try {
            const response =
                await fetch(
                    ENDPOINTS.reports,
                    {
                        method: "GET",
                        headers:
                            authHeaders()
                    }
                );

            const data =
                await readJSON(
                    response
                );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to load reports."
                );
            }

            const reports =
                extractArray(
                    data,
                    ["reports", "files"]
                );

            if (!reports.length) {
                results.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            +
                        </div>

                        <h2>
                            No reports found
                        </h2>

                        <p>
                            Your medical reports will appear here.
                        </p>
                    </div>
                `;
            } else {
                results.innerHTML =
                    reports
                        .map(reportCard)
                        .join("");
            }

            setMessage(
                message,
                `${reports.length} report(s).`,
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
   INITIAL PAGE SETUP
========================================================= */

const searchDateInput =
    $("#date");

if (searchDateInput) {
    searchDateInput.min =
        getTodayDate();

    searchDateInput.value =
        getTodayDate();
}

openTab("find");