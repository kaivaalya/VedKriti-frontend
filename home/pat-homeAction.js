import { domain } from "../config.js";

/* =========================================================
   API ENDPOINTS
========================================================= */

const ENDPOINTS = {
    findDoctor: `${domain}/api/doctor/find-doctor`,
    doctorProfile: (id) => `${domain}/api/doctor/profile/${encodeURIComponent(id)}`,
    bookDoctor: (id, consultationType) =>
        `${domain}/api/booking/book-doctor?id=${encodeURIComponent(id)}&consultationType=${encodeURIComponent(consultationType)}`,
    upcoming: `${domain}/api/booking/patient-bookings`,
    past: `${domain}/api/booking/patient-bookings`,
    agoraToken: (bookingId) =>
        `${domain}/api/booking/agora-token?bookingId=${encodeURIComponent(bookingId)}`,
    takeFeedback: (bookingId) =>
        `${domain}/api/booking/take-feedback?id=${encodeURIComponent(bookingId)}`,
    getReports: `${domain}/api/report/get-reports`
};

/* =========================================================
   CONSTANTS & UTILS
========================================================= */

const BLACK_STAR = "../media/bstar.png";
const YELLOW_STAR = "../media/ystar.png";

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const getToken = () => localStorage.getItem("token") || "";

const authHeaders = (includeJSON = false) => ({
    Authorization: `Bearer ${getToken()}`,
    ...(includeJSON ? { "Content-Type": "application/json" } : {})
});

const escapeHTML = (value) =>
    String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

const readJSON = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(text || "The server returned an invalid response.");
    }
    return response.json();
};

const setMessage = (element, text, state = "") => {
    if (!element) return;
    element.textContent = text;
    element.className = `message${state ? ` ${state}` : ""}`;
};

const renderLoader = (text = "Loading...") => `
    <div class="loader-container">
        <div class="spinner"></div>
        <p class="loader-text">${escapeHTML(text)}</p>
    </div>
`;

const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
    if (!value) return "N/A";
    const dateValue = String(value).slice(0, 10);
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const formatPrice = (price) => {
    const number = Number(price);
    if (!Number.isFinite(number)) return "N/A";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(number);
};

/* =========================================================
   TAB SWITCHING
========================================================= */

const tabContainer = $(".tabs-container");
const panels = $$(".tabs_panel > section");

const openTab = (panelId) => {
    panels.forEach((panel) => {
        panel.hidden = panel.id !== panelId;
    });

    $$("a", tabContainer).forEach((link) => {
        const isActive = link.getAttribute("href") === `#${panelId}`;
        link.classList.toggle("active", isActive);
        link.setAttribute("aria-selected", String(isActive));
    });

    if (panelId === "consultations") {
        loadUpcomingConsultations();
    } else if (panelId === "bookings") {
        loadPastBookings();
    } else if (panelId === "reports") {
        loadReports();
    }
};

tabContainer.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    event.preventDefault();
    openTab(href.slice(1));
});

/* =========================================================
   SEARCH DOCTORS (TAB 1)
========================================================= */

const doctorsMap = new Map();

const renderDoctorCard = (doctor) => {
    /*
      Excluding fields: verified, verificationNote, createdAt, updatedAt, __v, _id from card display text
    */
    const specialities = [
        doctor.specialization1,
        doctor.specialization2,
        doctor.specialization3
    ].filter(Boolean).join(", ");

    const qualification = [
        doctor.degreeType,
        doctor.degreeName,
        doctor.fieldOfStudy ? `(${doctor.fieldOfStudy})` : "",
        doctor.institute ? `from ${doctor.institute}` : ""
    ].filter(Boolean).join(" ");

    const location = [
        doctor.facilityName,
        doctor.address,
        doctor.city,
        doctor.state,
        doctor.country,
        doctor.pin ? `Pincode: ${doctor.pin}` : ""
    ].filter(Boolean).join(", ");

    const rating = Math.max(0, Math.min(5, Number(doctor.rating) || 0));

    return `
        <article class="doctor-card" data-doctor-id="${escapeHTML(doctor._id)}">
            <div class="doctor-card-body">
                <div class="doctor-photo-wrapper">
                    ${
                        doctor.photo
                            ? `<img class="doctor-photo" src="${escapeHTML(doctor.photo)}" alt="${escapeHTML(doctor.name || "Doctor")}">`
                            : `<div class="doctor-photo placeholder-photo">+</div>`
                    }
                </div>
                <div class="doctor-info">
                    <h2 class="doctor-name">Dr. ${escapeHTML(doctor.name || "Doctor")}</h2>
                    <p class="doctor-email">📧 ${escapeHTML(doctor.email || "N/A")}</p>
                    <p class="doctor-designation">💼 ${escapeHTML(doctor.designation || "Doctor")}</p>
                    ${specialities ? `<p class="doctor-specialities">🩺 <strong>Specialities:</strong> ${escapeHTML(specialities)}</p>` : ""}
                    ${qualification ? `<p class="doctor-qualification">🎓 <strong>Qualification:</strong> ${escapeHTML(qualification)}</p>` : ""}
                    ${location ? `<p class="doctor-location">📍 <strong>Location:</strong> ${escapeHTML(location)}</p>` : ""}
                    <div class="doctor-stats">
                        <span class="stat-fee">Fee: ${escapeHTML(formatPrice(doctor.consultationFee))}</span>
                        <span class="stat-rating">⭐ ${rating.toFixed(1)} / 5</span>
                        <span class="stat-patients">👥 ${escapeHTML(doctor.patientCount ?? 0)} Patients</span>
                    </div>
                    ${doctor.about ? `<p class="doctor-about">📝 ${escapeHTML(doctor.about)}</p>` : ""}
                </div>
            </div>
            <div class="doctor-card-footer">
                <button class="view-profile-btn" type="button" data-doctor-id="${escapeHTML(doctor._id)}">
                    View Profile & Book Slot &rarr;
                </button>
            </div>
        </article>
    `;
};

const renderDoctors = (doctors) => {
    doctorsMap.clear();
    (doctors || []).forEach(d => {
        if (d && d._id) doctorsMap.set(String(d._id), d);
    });
    const searchResults = $("#searchResults");
    if (!doctors || !doctors.length) {
        searchResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">+</div>
                <h2>No doctors found</h2>
                <p>Try matching with different location, speciality, price or rating filters.</p>
            </div>
        `;
        return;
    }
    searchResults.innerHTML = doctors.map(renderDoctorCard).join("");
};

$("#signinForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const searchButton = $("#search");
    const errorElement = $("#err");
    const searchResults = $("#searchResults");
    errorElement.textContent = "";

    const minPriceText = $("#minPrice").value.trim();
    const maxPriceText = $("#maxPrice").value.trim();
    const minRatingText = $("#minRating").value;

    const filters = {
        city: $("#city").value.trim(),
        specialization: $("#speciality").value.trim(),
        facilityName: $("#facility").value.trim(),
        name: $("#name").value.trim(),
        date: $("#date").value,
        minFee: minPriceText === "" ? null : Number(minPriceText),
        maxFee: maxPriceText === "" ? null : Number(maxPriceText),
        minRating: minRatingText === "" ? null : Number(minRatingText)
    };

    if (filters.minFee !== null && filters.minFee < 0) {
        errorElement.textContent = "Minimum price cannot be negative.";
        return;
    }
    if (filters.maxFee !== null && filters.maxFee < 0) {
        errorElement.textContent = "Maximum price cannot be negative.";
        return;
    }
    if (filters.minFee !== null && filters.maxFee !== null && filters.minFee > filters.maxFee) {
        errorElement.textContent = "Minimum price cannot be greater than maximum price.";
        return;
    }

    searchButton.disabled = true;
    searchButton.textContent = "Searching...";
    searchResults.innerHTML = renderLoader("Searching for doctors...");

    try {
        const params = new URLSearchParams();
        if (filters.city) params.set("city", filters.city);
        if (filters.facilityName) params.set("facilityName", filters.facilityName);
        if (filters.specialization) params.set("specialization", filters.specialization);
        if (filters.name) params.set("name", filters.name);
        if (filters.minFee !== null) params.set("minFee", filters.minFee);
        if (filters.maxFee !== null) params.set("maxFee", filters.maxFee);
        if (filters.minRating !== null) params.set("minRating", filters.minRating);
        if (filters.date) params.set("date", filters.date);

        const response = await fetch(`${ENDPOINTS.findDoctor}?${params}`, {
            method: "GET",
            headers: authHeaders()
        });

        const data = await readJSON(response);

        if (!response.ok) {
            throw new Error(data.message || "No doctors found matching your criteria.");
        }

        const doctors = data.data || [];
        renderDoctors(doctors);
    } catch (error) {
        errorElement.textContent = error.message;
        searchResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">!</div>
                <h2>No doctors found</h2>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    } finally {
        searchButton.disabled = false;
        searchButton.textContent = "Search Doctors";
    }
});

/* =========================================================
   DOCTOR PROFILE & AVAILABILITY VIEW (TAB 1 DETAIL)
========================================================= */

const fetchDoctorProfile = async (doctorId, fallbackDoctor = null) => {
    const searchContainer = $("#doctorSearchContainer");
    const profileContainer = $("#doctorProfileContainer");

    profileContainer.innerHTML = renderLoader("Fetching doctor profile & slot availability...");
    profileContainer.hidden = false;
    searchContainer.hidden = true;

    try {
        const response = await fetch(ENDPOINTS.doctorProfile(doctorId), {
            method: "GET",
            headers: authHeaders()
        });
        const data = await readJSON(response);

        if (!response.ok) {
            throw new Error(data.message || "Failed to load doctor profile.");
        }

        renderDoctorProfileView(data.data);
    } catch (err) {
        console.warn("getDoctorProfile API warning:", err.message);
        if (fallbackDoctor) {
            renderDoctorProfileView({
                doctor: fallbackDoctor,
                experiance: [],
                availability: [],
                feedback: []
            });
        } else {
            profileContainer.innerHTML = `
                <div class="profile-error">
                    <button id="backToSearch" class="back-button" type="button">&larr; Back to Doctor Search</button>
                    <p class="error-message">${escapeHTML(err.message)}</p>
                </div>
            `;
            $("#backToSearch").addEventListener("click", () => {
                profileContainer.hidden = true;
                searchContainer.hidden = false;
            });
        }
    }
};

const buildDatesList = (availabilityList, doctor) => {
    if (availabilityList && availabilityList.length > 0) {
        return availabilityList.map(item => {
            const rawDate = item.date;
            const d = new Date(rawDate);
            const dateStr = String(rawDate).slice(0, 10);
            const displayDate = Number.isNaN(d.getTime())
                ? String(rawDate)
                : d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
            const backendDate = String(rawDate);
            const jsDay = Number.isNaN(d.getTime()) ? 1 : d.getDay();
            const dayNum = jsDay === 0 ? 7 : jsDay;
            const isHoliday = String(doctor.holidays || "").includes(String(dayNum));

            return {
                dateStr,
                displayDate,
                backendDate,
                isHoliday,
                slots: {
                    MORNING: {
                        capacity: Number(item.morningCapacity ?? doctor.morningCapacity ?? 0),
                        bookings: Number(item.morningBookings ?? 0)
                    },
                    AFTERNOON: {
                        capacity: Number(item.afternoonCapacity ?? doctor.afternoonCapacity ?? 0),
                        bookings: Number(item.afternoonBookings ?? 0)
                    },
                    EVENING: {
                        capacity: Number(item.eveningCapacity ?? doctor.eveningCapacity ?? 0),
                        bookings: Number(item.eveningBookings ?? 0)
                    }
                }
            };
        });
    }

    // Fallback: Generate 14 days starting from today if availabilityList is empty
    const datesList = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dStr = d.toISOString().slice(0, 10);
        const jsDay = d.getDay();
        const dayNum = jsDay === 0 ? 7 : jsDay;
        const isHoliday = String(doctor.holidays || "").includes(String(dayNum));

        datesList.push({
            dateStr: dStr,
            displayDate: d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }),
            backendDate: d.toISOString(),
            isHoliday,
            slots: {
                MORNING: {
                    capacity: Number(doctor.morningCapacity ?? 0),
                    bookings: 0
                },
                AFTERNOON: {
                    capacity: Number(doctor.afternoonCapacity ?? 0),
                    bookings: 0
                },
                EVENING: {
                    capacity: Number(doctor.eveningCapacity ?? 0),
                    bookings: 0
                }
            }
        });
    }

    return datesList;
};

const renderDoctorProfileView = (profileData) => {
    const { doctor, experiance, availability, feedback } = profileData;
    const experiencesList = experiance || profileData.experience || [];
    const availabilityList = availability || [];
    const feedbackList = feedback || [];

    const profileContainer = $("#doctorProfileContainer");
    const datesList = buildDatesList(availabilityList, doctor);

    const specialities = [doctor.specialization1, doctor.specialization2, doctor.specialization3].filter(Boolean).join(", ");
    const qualification = [doctor.degreeType, doctor.degreeName, doctor.fieldOfStudy ? `(${doctor.fieldOfStudy})` : "", doctor.institute ? `from ${doctor.institute}` : ""].filter(Boolean).join(" ");
    const location = [doctor.facilityName, doctor.address, doctor.city, doctor.state, doctor.country, doctor.pin ? `PIN: ${doctor.pin}` : ""].filter(Boolean).join(", ");
    const doctorRating = Math.max(0, Math.min(5, Number(doctor.rating) || 0));

    profileContainer.innerHTML = `
        <div class="doctor-profile-header">
            <button id="backToSearch" class="back-button" type="button">&larr; Back to Doctor Discovery</button>
            <h1 class="profile-title">Dr. ${escapeHTML(doctor.name)}</h1>
        </div>

        <section class="availability-section">
            <div class="section-title">
                <h2>🗓️ Available Booking Slots</h2>
                <p>Select date, slot, and consultation type (Online/Offline) to book an appointment.</p>
            </div>
            <div class="availability-carousel">
                ${datesList.map(item => {
                    return `
                        <div class="date-card ${item.isHoliday ? "holiday-card" : ""}">
                            <div class="date-header">
                                <h3>${escapeHTML(item.displayDate)}</h3>
                                ${item.isHoliday ? `<span class="badge holiday-badge">Holiday</span>` : ""}
                            </div>
                            <p class="date-backend-raw">${escapeHTML(item.backendDate)}</p>
                            <div class="slots-container">
                                ${["MORNING", "AFTERNOON", "EVENING"].map(slotKey => {
                                    const slotData = item.slots[slotKey];
                                    const available = slotData.capacity - slotData.bookings;
                                    const isAvailable = available > 0 && !item.isHoliday;
                                    const statusText = item.isHoliday
                                        ? "Doctor Holiday"
                                        : (isAvailable ? `${available} available` : "Waiting list");
                                    const inputName = `consultType_${item.dateStr}_${slotKey}`;

                                    return `
                                        <div class="slot-box ${isAvailable ? "slot-available" : "slot-waiting"}">
                                            <div class="slot-header-row">
                                                <span class="slot-name">${slotKey}</span>
                                                <span class="slot-badge ${isAvailable ? "badge-available" : "badge-waiting"}">
                                                    ${escapeHTML(statusText)}
                                                </span>
                                            </div>
                                            <div class="slot-capacity-info">
                                                <span class="capacity-label">Capacity: ${slotData.capacity}</span>
                                                <span class="booked-label">Booked: ${slotData.bookings}</span>
                                            </div>
                                            <div class="consultation-radio-group">
                                                <label class="radio-option">
                                                    <input type="radio" name="${inputName}" value="ONLINE" checked>
                                                    <span>Online</span>
                                                </label>
                                                <label class="radio-option">
                                                    <input type="radio" name="${inputName}" value="OFFLINE">
                                                    <span>Offline</span>
                                                </label>
                                            </div>
                                            <button
                                                class="book-slot-action-btn"
                                                type="button"
                                                data-doc-id="${escapeHTML(doctor._id)}"
                                                data-date="${escapeHTML(item.dateStr)}"
                                                data-slot="${slotKey}"
                                                data-radio-name="${inputName}"
                                            >
                                                Book ${slotKey.toLowerCase()}
                                            </button>
                                        </div>
                                    `;
                                }).join("")}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
            <p id="profileBookingMessage" class="message" aria-live="polite"></p>
        </section>

        <section class="doctor-detail-section">
            <div class="profile-main-info">
                ${doctor.photo ? `<img class="doctor-photo-lg" src="${escapeHTML(doctor.photo)}" alt="Dr. ${escapeHTML(doctor.name)}">` : `<div class="doctor-photo-lg placeholder-photo">+</div>`}
                <div class="profile-details-content">
                    <h2>Dr. ${escapeHTML(doctor.name)}</h2>
                    <p class="email">📧 ${escapeHTML(doctor.email)}</p>
                    <p class="designation">💼 ${escapeHTML(doctor.designation)}</p>
                    ${specialities ? `<p>🩺 <strong>Specialities:</strong> ${escapeHTML(specialities)}</p>` : ""}
                    ${qualification ? `<p>🎓 <strong>Qualification:</strong> ${escapeHTML(qualification)}</p>` : ""}
                    ${location ? `<p>📍 <strong>Facility & Address:</strong> ${escapeHTML(location)}</p>` : ""}
                    <div class="profile-badges">
                        <span class="badge fee-badge">Consultation Fee: ${escapeHTML(formatPrice(doctor.consultationFee))}</span>
                        <span class="badge rating-badge">Rating: ${doctorRating.toFixed(1)} / 5</span>
                        <span class="badge patient-badge">Patients Consulted: ${escapeHTML(doctor.patientCount ?? 0)}</span>
                    </div>
                    ${doctor.about ? `<div class="about-box"><h3>About Doctor</h3><p>${escapeHTML(doctor.about)}</p></div>` : ""}
                </div>
            </div>
        </section>

        <section class="experience-timeline-section">
            <h2>🏥 Experience & Hospital Work</h2>
            ${experiencesList.length ? `
                <div class="timeline-container">
                    ${experiencesList.map((exp, index) => {
                        const side = index % 2 === 0 ? "left" : "right";
                        const start = formatDate(exp.startDate);
                        const end = exp.isCurrent ? "Present" : formatDate(exp.endDate);
                        return `
                            <div class="timeline-item ${side}">
                                <div class="timeline-dot"></div>
                                <div class="timeline-content">
                                    <h3>${escapeHTML(exp.facilityName || "Hospital / Clinic")}</h3>
                                    <span class="timeline-date">${escapeHTML(start)} - ${escapeHTML(end)}</span>
                                    <p class="timeline-role">${escapeHTML(exp.designation || "Medical Specialist")}</p>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            ` : `
                <div class="no-feedback-state">
                    <p>No experience records available for this doctor.</p>
                </div>
            `}
        </section>

        ${feedbackList.length ? `
            <section class="patient-reviews-section">
                <h2>⭐ Patient Feedback & Reviews (${feedbackList.length})</h2>
                <div class="reviews-grid">
                    ${feedbackList.map(fb => {
                        const patName = fb.patID?.name || "Patient";
                        const r = Math.max(0, Math.min(5, Number(fb.rating) || 0));
                        return `
                            <div class="review-card">
                                <div class="review-header">
                                    <strong class="patient-name">${escapeHTML(patName)}</strong>
                                    <span class="review-rating">${r} / 5 ⭐</span>
                                </div>
                                <p class="review-text">${escapeHTML(fb.feedback || "No written review.")}</p>
                            </div>
                        `;
                    }).join("")}
                </div>
            </section>
        ` : `
            <section class="patient-reviews-section">
                <h2>⭐ Patient Feedback & Reviews</h2>
                <div class="no-feedback-state">
                    <p>No patient reviews yet. Be the first to consult and leave a review!</p>
                </div>
            </section>
        `}
    `;

    $("#backToSearch").addEventListener("click", () => {
        $("#doctorProfileContainer").hidden = true;
        $("#doctorSearchContainer").hidden = false;
    });

    setupTimelineObserver();
};

/* =========================================================
   ANIMATE EXPERIENCE TIMELINE ON SCROLL
========================================================= */

const setupTimelineObserver = () => {
    const items = $$(".timeline-item");
    if (!items.length) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15 }
    );

    items.forEach((item) => observer.observe(item));
};

/* =========================================================
   BOOK SLOT EVENT LISTENER
========================================================= */

$("#doctorProfileContainer").addEventListener("click", async (event) => {
    const bookBtn = event.target.closest(".book-slot-action-btn");
    if (!bookBtn) return;

    const docId = bookBtn.dataset.docId;
    const date = bookBtn.dataset.date;
    const slot = bookBtn.dataset.slot;
    const radioName = bookBtn.dataset.radioName;

    const selectedRadio = $(`input[name="${radioName}"]:checked`);
    const consultationType = selectedRadio ? selectedRadio.value : "ONLINE";

    const msgEl = $("#profileBookingMessage");
    setMessage(msgEl, "Booking appointment...", "");

    bookBtn.disabled = true;
    bookBtn.textContent = "Booking...";

    try {
        const url = ENDPOINTS.bookDoctor(docId, consultationType);
        const response = await fetch(url, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({ date, slot })
        });

        const data = await readJSON(response);

        if (!response.ok) {
            throw new Error(data.message || "Booking failed.");
        }

        setMessage(msgEl, data.message || "Appointment booked successfully!", "success");
        globalThis.alert(data.message || "Appointment booked successfully!");

        // Open Upcoming Consultations tab
        openTab("consultations");
    } catch (err) {
        setMessage(msgEl, err.message, "error");
    } finally {
        bookBtn.disabled = false;
        bookBtn.textContent = `Book ${slot.toLowerCase()}`;
    }
});

// Click Doctor Card to open Doctor Profile
$("#searchResults").addEventListener("click", (event) => {
    const card = event.target.closest(".doctor-card, .view-profile-btn");
    if (!card) return;
    const docId = card.dataset.doctorId;
    const fallbackDoctor = doctorsMap.get(String(docId));
    if (docId) {
        fetchDoctorProfile(docId, fallbackDoctor);
    }
});

/* =========================================================
   TAB 2: UPCOMING CONSULTATIONS
========================================================= */

const renderUpcomingCard = (booking) => {
    const bookingId = booking._id || booking.id;
    const consultationType = String(booking.consultationType || "OFFLINE").toUpperCase();
    const status = String(booking.status || "PENDING").toUpperCase();
    const tokenNum = booking.token ?? booking.tokenNumber ?? 0;

    const docName = booking.docID?.name || booking.doctorName || booking.docName || "Doctor";
    const facility = booking.docID?.facilityName || booking.facilityName || "";

    const isOnline = consultationType === "ONLINE";

    return `
        <article class="booking-card" data-booking-id="${escapeHTML(bookingId)}">
            <div class="booking-card-main">
                <div class="booking-header">
                    <h2>Dr. ${escapeHTML(docName)}</h2>
                    <span class="status-badge status-${status.toLowerCase()}">${escapeHTML(status)}</span>
                </div>
                <div class="booking-details-grid">
                    <p>📅 <strong>Date:</strong> ${escapeHTML(formatDate(booking.date))}</p>
                    <p>⏰ <strong>Slot:</strong> ${escapeHTML(booking.slot || "N/A")}</p>
                    <p>💻 <strong>Type:</strong> <span class="type-badge">${escapeHTML(consultationType)}</span></p>
                    <p>🎫 <strong>Token Number:</strong> <span class="token-badge">${tokenNum}</span> ${tokenNum === 0 ? `<small class="token-note">(Consultation not started)</small>` : ""}</p>
                    ${facility ? `<p>🏥 <strong>Facility:</strong> ${escapeHTML(facility)}</p>` : ""}
                </div>
            </div>
            ${isOnline ? `
                <div class="booking-card-actions">
                    <button
                        class="join-conference-btn"
                        type="button"
                        data-booking-id="${escapeHTML(bookingId)}"
                    >
                        📹 Join Consultation
                    </button>
                </div>
            ` : ""}
        </article>
    `;
};

const loadUpcomingConsultations = async () => {
    const results = $("#consultationResults");
    const message = $("#consultationMessage");
    const refreshButton = $("#refreshConsultations");

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
    }
    setMessage(message, "Loading upcoming consultations...");
    results.innerHTML = renderLoader("Loading upcoming consultations...");

    try {
        const response = await fetch(ENDPOINTS.upcoming, {
            method: "GET",
            headers: authHeaders()
        });
        const data = await readJSON(response);

        if (!response.ok) {
            throw new Error(data.message || "Failed to load upcoming consultations.");
        }

        const allBookings = data.data || data.consultations || data.bookings || [];
        const upcoming = allBookings.filter(b => ["PENDING", "CONFIRMED", "CONSULTING"].includes(String(b.status).toUpperCase()));

        if (!upcoming.length) {
            results.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">+</div>
                    <h2>No upcoming consultations</h2>
                    <p>Your upcoming appointments will appear here once booked.</p>
                </div>
            `;
            setMessage(message, "No upcoming consultations found.", "");
        } else {
            results.innerHTML = upcoming.map(renderUpcomingCard).join("");
            setMessage(message, `Found ${upcoming.length} upcoming consultation(s).`, "success");
        }
    } catch (err) {
        setMessage(message, err.message, "error");
        results.innerHTML = "";
    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "Refresh";
        }
    }
};

if ($("#refreshConsultations")) {
    $("#refreshConsultations").addEventListener("click", loadUpcomingConsultations);
}

// Join Online Conference
$("#consultationResults").addEventListener("click", async (event) => {
    const btn = event.target.closest(".join-conference-btn");
    if (!btn) return;

    const bookingId = btn.dataset.bookingId;
    if (!bookingId) return;

    btn.disabled = true;
    btn.textContent = "Connecting...";

    try {
        const response = await fetch(ENDPOINTS.agoraToken(bookingId), {
            method: "GET",
            headers: authHeaders()
        });
        const data = await readJSON(response);

        if (!response.ok) {
            throw new Error(data.message || "Unable to fetch video credentials.");
        }

        const payload = data.data || data;
        const appId = payload.appId || payload.agoraAppId;
        const token = payload.token || payload.rtcToken;
        const channelName = payload.channelName || payload.channel;

        if (!appId || !token || !channelName) {
            throw new Error("Invalid conference token response from backend.");
        }

        localStorage.setItem("agoraAppId", appId);
        localStorage.setItem("conferenceToken", token);
        localStorage.setItem("conferenceChannel", channelName);

        globalThis.location.href = "../conference/index.html";
    } catch (err) {
        setMessage($("#consultationMessage"), err.message, "error");
        btn.disabled = false;
        btn.textContent = "📹 Join Consultation";
    }
});

/* =========================================================
   TAB 3: PAST BOOKINGS & FEEDBACK
========================================================= */

const renderRatingStars = (rating, interactive = false) => {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    return Array.from({ length: 5 }, (_, i) => {
        const starNum = i + 1;
        const src = starNum <= r ? YELLOW_STAR : BLACK_STAR;
        if (!interactive) {
            return `<img class="star-img" src="${src}" alt="star">`;
        }
        return `
            <button type="button" class="star-btn" data-rating="${starNum}" aria-label="${starNum} stars">
                <img class="star-img" src="${src}" alt="star">
            </button>
        `;
    }).join("");
};

const renderPastCard = (booking) => {
    const bookingId = booking._id || booking.id;
    const status = String(booking.status || "DONE").toUpperCase();
    const docName = booking.docID?.name || booking.doctorName || booking.docName || "Doctor";
    const isDone = status === "DONE";
    const hasFeedback = booking.rating != null;

    return `
        <article class="booking-card past-card" data-booking-id="${escapeHTML(bookingId)}">
            <div class="booking-card-main">
                <div class="booking-header">
                    <h2>Dr. ${escapeHTML(docName)}</h2>
                    <span class="status-badge status-${status.toLowerCase()}">${escapeHTML(status)}</span>
                </div>
                <div class="booking-details-grid">
                    <p>📅 <strong>Date:</strong> ${escapeHTML(formatDate(booking.date))}</p>
                    <p>⏰ <strong>Slot:</strong> ${escapeHTML(booking.slot || "N/A")}</p>
                    <p>💻 <strong>Type:</strong> ${escapeHTML(booking.consultationType || "OFFLINE")}</p>
                </div>
            </div>

            ${isDone ? `
                <div class="feedback-container">
                    ${hasFeedback ? `
                        <div class="existing-feedback">
                            <h3>Your Feedback</h3>
                            <div class="stars-display">${renderRatingStars(booking.rating)} <span>(${booking.rating}/5)</span></div>
                            <p class="feedback-text">${escapeHTML(booking.feedback || "No written review provided.")}</p>
                        </div>
                    ` : `
                        <form class="feedback-form" data-booking-id="${escapeHTML(bookingId)}">
                            <h3>Submit Feedback & Review</h3>
                            <div class="star-rating-picker" data-selected-rating="5">
                                ${renderRatingStars(5, true)}
                            </div>
                            <div class="form-group">
                                <textarea name="feedback" placeholder="Write your review about the consultation..." required></textarea>
                            </div>
                            <p class="feedback-msg message"></p>
                            <button type="submit" class="submit-feedback-btn">Submit Review</button>
                        </form>
                    `}
                </div>
            ` : ""}
        </article>
    `;
};

const loadPastBookings = async () => {
    const results = $("#pastBookingResults");
    const message = $("#bookingHistoryMessage");

    setMessage(message, "Loading past bookings...");
    results.innerHTML = renderLoader("Loading past bookings...");

    try {
        const response = await fetch(ENDPOINTS.past, {
            method: "GET",
            headers: authHeaders()
        });
        const data = await readJSON(response);

        if (!response.ok) {
            throw new Error(data.message || "Failed to load past bookings.");
        }

        const allBookings = data.data || data.bookings || data.consultations || [];
        const past = allBookings.filter(b => ["DONE", "CANCELED"].includes(String(b.status).toUpperCase()));

        if (!past.length) {
            results.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">+</div>
                    <h2>No past bookings</h2>
                    <p>Your completed or canceled appointments will appear here.</p>
                </div>
            `;
            setMessage(message, "No past bookings found.", "");
        } else {
            results.innerHTML = past.map(renderPastCard).join("");
            setMessage(message, `Found ${past.length} past booking(s).`, "success");
        }
    } catch (err) {
        setMessage(message, err.message, "error");
        results.innerHTML = "";
    }
};

// Past bookings feedback interaction
$("#pastBookingResults").addEventListener("click", (event) => {
    const starBtn = event.target.closest(".star-btn");
    if (!starBtn) return;

    const picker = starBtn.closest(".star-rating-picker");
    const rating = Number(starBtn.dataset.rating);
    picker.dataset.selectedRating = rating;

    $$(".star-btn", picker).forEach((btn) => {
        const r = Number(btn.dataset.rating);
        const img = $("img", btn);
        img.src = r <= rating ? YELLOW_STAR : BLACK_STAR;
    });
});

$("#pastBookingResults").addEventListener("submit", async (event) => {
    const form = event.target.closest(".feedback-form");
    if (!form) return;

    event.preventDefault();
    const bookingId = form.dataset.bookingId;
    const feedback = $("textarea[name='feedback']", form).value.trim();
    const picker = $(".star-rating-picker", form);
    const rating = Number(picker.dataset.selectedRating || 5);
    const msgEl = $(".feedback-msg", form);
    const submitBtn = $(".submit-feedback-btn", form);

    if (!feedback) {
        setMessage(msgEl, "Please write your review.", "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const url = ENDPOINTS.takeFeedback(bookingId);
        const response = await fetch(url, {
            method: "PUT",
            headers: authHeaders(true),
            body: JSON.stringify({ rating, feedback })
        });
        const data = await readJSON(response);

        if (!response.ok) {
            throw new Error(data.message || "Failed to submit feedback.");
        }

        setMessage($("#bookingHistoryMessage"), data.message || "Feedback submitted successfully!", "success");
        await loadPastBookings();
    } catch (err) {
        setMessage(msgEl, err.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Review";
    }
});

/* =========================================================
   TAB 4: REPORTS
========================================================= */

const renderReportCard = (report) => {
    const fileUrl = report.fileUrl || report.url || report.reportUrl || "#";
    const title = report.title || report.name || "Medical Report";
    const category = report.category || "General";
    const fileType = String(report.fileType || "PDF").toUpperCase();
    const uploadedAt = formatDate(report.createdAt || report.date);

    return `
        <article class="report-card">
            <div class="report-main">
                <div class="report-icon">📄</div>
                <div class="report-info">
                    <h2>${escapeHTML(title)}</h2>
                    <p>📂 <strong>Category:</strong> ${escapeHTML(category)} | 📌 <strong>Format:</strong> ${escapeHTML(fileType)}</p>
                    <p>🗓️ <strong>Uploaded:</strong> ${escapeHTML(uploadedAt)}</p>
                </div>
            </div>
            <div class="report-actions">
                <a class="download-report-btn" href="${escapeHTML(fileUrl)}" target="_blank" rel="noopener noreferrer" download>
                    📥 Open / Download Report
                </a>
            </div>
        </article>
    `;
};

const loadReports = async () => {
    const results = $("#reportResults");
    const message = $("#reportMessage");

    setMessage(message, "Loading medical reports...");
    results.innerHTML = renderLoader("Loading medical reports...");

    try {
        const response = await fetch(ENDPOINTS.getReports, {
            method: "GET",
            headers: authHeaders()
        });
        const data = await readJSON(response);

        if (!response.ok) {
            throw new Error(data.message || "Failed to load reports.");
        }

        const reports = data.data || data.reports || [];

        if (!reports.length) {
            results.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">+</div>
                    <h2>No medical reports found</h2>
                    <p>Your diagnostic and consultation reports will appear here.</p>
                </div>
            `;
            setMessage(message, "No reports available.", "");
        } else {
            results.innerHTML = reports.map(renderReportCard).join("");
            setMessage(message, `Loaded ${reports.length} report(s).`, "success");
        }
    } catch (err) {
        setMessage(message, err.message, "error");
        results.innerHTML = "";
    }
};

/* =========================================================
   INITIALIZATION
========================================================= */

const searchDateInput = $("#date");
if (searchDateInput) {
    searchDateInput.min = getTodayDate();
    searchDateInput.value = getTodayDate();
}

openTab("find");