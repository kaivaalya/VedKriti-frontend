import { domain } from "../config.js";

/* =========================
   COMMON ELEMENTS
========================= */

const tabContainer = document.querySelector(".tabs-container");
const tabButtons = tabContainer.querySelectorAll("a");
const tabPanels = document.querySelectorAll(".tabs__panel > div");

const profilePic = document.querySelector("#about img");
const inputFile = document.getElementById("pfp");

const experienceForm = document.querySelector("#experiance form");
const addExperienceButton = document.getElementById("add");

let experienceCount = 1;
let experiencesLoaded = false;

/* =========================
   HELPER FUNCTIONS
========================= */

const getToken = () => localStorage.getItem("token");

const showError = (message) => {
    console.error(message);
    alert(message);
};

/*
 * Reads the complete JSON response.
 *
 * For an object response:
 *
 * {
 *     status: "SUCCESS",
 *     data: {
 *         city: "Gwalior"
 *     }
 * }
 *
 * It returns:
 *
 * {
 *     status: "SUCCESS",
 *     data: {...},
 *     city: "Gwalior"
 * }
 *
 * Arrays are not merged because array-based responses,
 * such as experiences, are handled separately.
 */
const getResponseData = async (response) => {
    try {
        const json = await response.json();
        const responseData = json?.data;

        if (
            responseData &&
            typeof responseData === "object" &&
            !Array.isArray(responseData)
        ) {
            return {
                ...json,
                ...responseData
            };
        }

        return json || {};
    } catch {
        return {};
    }
};

/*
 * Starts or stops the loader on a button.
 *
 * It supports both:
 *
 * <button type="submit">Save</button>
 *
 * and:
 *
 * <input type="submit" value="Save">
 */
const setButtonLoading = (
    button,
    isLoading,
    loadingText = "Saving..."
) => {
    if (!button) {
        return;
    }

    if (isLoading) {
        const isInput = button.matches(
            'input[type="submit"], input[type="button"]'
        );

        button.dataset.controlType = isInput
            ? "input"
            : "button";

        button.dataset.originalContent = isInput
            ? button.value
            : button.innerHTML;

        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.classList.add("submit-button-loading");

        if (isInput) {
            button.value = `⏳ ${loadingText}`;
        } else {
            button.innerHTML = `
                <span
                    class="submit-button-spinner"
                    aria-hidden="true"
                ></span>
                ${loadingText}
            `;
        }

        return;
    }

    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.classList.remove("submit-button-loading");

    if (button.dataset.originalContent !== undefined) {
        if (button.dataset.controlType === "input") {
            button.value =
                button.dataset.originalContent;
        } else {
            button.innerHTML =
                button.dataset.originalContent;
        }

        delete button.dataset.originalContent;
        delete button.dataset.controlType;
    }
};

/*
 * Wait for the browser to paint the loader before
 * starting the API request.
 */
const waitForNextPaint = () =>
    new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });

/*
 * Add loader styling dynamically.
 */
if (!document.getElementById("submit-button-loader-style")) {
    const loaderStyle = document.createElement("style");

    loaderStyle.id = "submit-button-loader-style";

    loaderStyle.textContent = `
        .submit-button-loading {
            cursor: wait;
            opacity: 0.8;
        }

        .submit-button-spinner {
            display: inline-block;
            width: 0.9em;
            height: 0.9em;
            margin-right: 0.5em;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            vertical-align: -0.12em;
            animation: submit-button-spin 0.7s linear infinite;
        }

        @keyframes submit-button-spin {
            to {
                transform: rotate(360deg);
            }
        }
    `;

    document.head.appendChild(loaderStyle);
}

const formatDateForInput = (date) => {
    if (!date) {
        return "";
    }

    return String(date).split("T")[0];
};

/* =========================
   TAB HANDLING
========================= */

const showPanel = (activePanel) => {
    tabPanels.forEach((panel) => {
        panel.hidden = panel !== activePanel;
    });

    tabButtons.forEach((tab) => {
        const isActive =
            tab.getAttribute("href") ===
            `#${activePanel.id}`;

        tab.classList.toggle("active", isActive);

        tab.setAttribute(
            "aria-selected",
            String(isActive)
        );

        if (isActive) {
            tab.setAttribute("aria-current", "step");
        } else {
            tab.removeAttribute("aria-current");
        }
    });

    activePanel.dispatchEvent(
        new CustomEvent("panelactive", {
            bubbles: true
        })
    );
};

tabContainer.addEventListener("click", (event) => {
    const clickedTab = event.target.closest("a");

    if (
        !clickedTab ||
        !tabContainer.contains(clickedTab)
    ) {
        return;
    }

    event.preventDefault();

    const panelSelector =
        clickedTab.getAttribute("href");

    const activePanel =
        document.querySelector(panelSelector);

    if (activePanel) {
        showPanel(activePanel);
    }
});

/* =========================
   PROFILE-PICTURE PREVIEW
========================= */

inputFile.addEventListener("change", () => {
    const file = inputFile.files[0];

    if (!file) {
        return;
    }

    profilePic.src = URL.createObjectURL(file);
});

/* =========================
   PRACTICE LOCATION
========================= */

document
    .getElementById("location")
    .addEventListener("panelactive", async () => {
        try {
            const response = await fetch(
                `${domain}/api/doctor/get-practiceLocation`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`
                    }
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                showError(
                    data.message ||
                    "Unable to get practice-location details."
                );

                return;
            }

            document.getElementById("city").value =
                data.city || "";

            document.getElementById("state").value =
                data.state || "";

            document.getElementById("country").value =
                data.country || "";

            document.getElementById("address").value =
                data.address || "";

            document.getElementById("PIN").value =
                data.pin || "";

            document.getElementById("facility").value =
                data.facilityName || "";

            document.getElementById("fee").value =
                data.consultationFee ?? "";
        } catch (error) {
            showError(error.message);
        }
    });

document
    .getElementById("btnLoc")
    .addEventListener("click", async (event) => {
        event.preventDefault();

        const submitButton = event.currentTarget;
        const currentForm =
            submitButton.closest("form");

        if (!currentForm.checkValidity()) {
            currentForm.reportValidity();
            return;
        }

        const city =
            document
                .getElementById("city")
                .value.trim();

        const state =
            document
                .getElementById("state")
                .value.trim();

        const country =
            document
                .getElementById("country")
                .value.trim();

        const address =
            document
                .getElementById("address")
                .value.trim();

        const pin =
            document
                .getElementById("PIN")
                .value.trim();

        const facilityName =
            document
                .getElementById("facility")
                .value.trim();

        const consultationFee =
            document.getElementById("fee").value;

        setButtonLoading(
            submitButton,
            true,
            "Saving..."
        );

        await waitForNextPaint();

        try {
            const response = await fetch(
                `${domain}/api/doctor/set-practiceLocation`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${getToken()}`
                    },

                    body: JSON.stringify({
                        city,
                        state,
                        country,
                        address,
                        pin,
                        facilityName,
                        consultationFee
                    })
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                showError(
                    data.message ||
                    "Unable to save practice-location details."
                );

                return;
            }

            document
                .getElementById("tab2")
                .click();
        } catch (error) {
            showError(error.message);
        } finally {
            setButtonLoading(
                submitButton,
                false
            );
        }
    });

/* =========================
   EDUCATION
========================= */

document
    .getElementById("education")
    .addEventListener("panelactive", async () => {
        try {
            const response = await fetch(
                `${domain}/api/doctor/get-education`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`
                    }
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                showError(
                    data.message ||
                    "Unable to get education details."
                );

                return;
            }

            document.getElementById("institute").value =
                data.institute || "";

            document.getElementById("deg_type").value =
                data.degreeType || "";

            document.getElementById("deg_name").value =
                data.degreeName || "";

            document.getElementById(
                "feildOfStudy"
            ).value =
                data.fieldOfStudy ||
                data.feildOfStudy ||
                "";

            document.getElementById("s1").value =
                data.specialization1 || "";

            document.getElementById("s2").value =
                data.specialization2 || "";

            document.getElementById("s3").value =
                data.specialization3 || "";
        } catch (error) {
            showError(error.message);
        }
    });

document
    .getElementById("btnEdu")
    .addEventListener("click", async (event) => {
        event.preventDefault();

        const submitButton = event.currentTarget;
        const currentForm =
            submitButton.closest("form");

        if (!currentForm.checkValidity()) {
            currentForm.reportValidity();
            return;
        }

        const institute =
            document
                .getElementById("institute")
                .value.trim();

        const degreeType =
            document
                .getElementById("deg_type")
                .value.trim();

        const degreeName =
            document
                .getElementById("deg_name")
                .value.trim();

        const fieldOfStudy =
            document
                .getElementById("feildOfStudy")
                .value.trim();

        const specialization1 =
            document
                .getElementById("s1")
                .value.trim();

        const specialization2 =
            document
                .getElementById("s2")
                .value.trim();

        const specialization3 =
            document
                .getElementById("s3")
                .value.trim();

        setButtonLoading(
            submitButton,
            true,
            "Saving..."
        );

        await waitForNextPaint();

        try {
            const response = await fetch(
                `${domain}/api/doctor/set-education`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${getToken()}`
                    },

                    body: JSON.stringify({
                        institute,
                        degreeType,
                        degreeName,
                        fieldOfStudy,
                        specialization1,
                        specialization2,
                        specialization3
                    })
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                showError(
                    data.message ||
                    "Unable to save education details."
                );

                return;
            }

            document
                .getElementById("tab3")
                .click();
        } catch (error) {
            showError(error.message);
        } finally {
            setButtonLoading(
                submitButton,
                false
            );
        }
    });

/* =========================
   EXPERIENCE
========================= */

const createExperienceFields = (experience = {}) => {
    experienceCount++;

    const experienceBlock =
        document.createElement("span");

    experienceBlock.id =
        `exp_${experienceCount}`;

    experienceBlock.className =
        "experience-entry";

    experienceBlock.innerHTML = `
        <div>
            <label for="exp_facility_${experienceCount}">
                Facility Name:

                <input
                    type="text"
                    id="exp_facility_${experienceCount}"
                    name="exp_facility_${experienceCount}"
                    placeholder="Enter Facility Name"
                    value="${experience.facilityName || ""}"
                    required
                >
            </label>

            <label for="exp_designation_${experienceCount}">
                Designation:

                <input
                    type="text"
                    id="exp_designation_${experienceCount}"
                    name="exp_designation_${experienceCount}"
                    placeholder="Enter Designation"
                    value="${experience.designation || ""}"
                    required
                >
            </label>
        </div>

        <br>

        <div>
            <label for="start_${experienceCount}">
                Start Date:

                <input
                    type="date"
                    id="start_${experienceCount}"
                    name="start_${experienceCount}"
                    value="${formatDateForInput(
                        experience.startDate
                    )}"
                    required
                >
            </label>

            <label for="end_${experienceCount}">
                End Date:

                <input
                    type="date"
                    id="end_${experienceCount}"
                    name="end_${experienceCount}"
                    value="${formatDateForInput(
                        experience.endDate
                    )}"
                    required
                >
            </label>
        </div>

        <br>

        <button
            type="button"
            class="delBtn"
        >
            Delete Experience
        </button>

        <br>
        <br>
    `;

    const buttonContainer =
        addExperienceButton.parentElement;

    experienceForm.insertBefore(
        experienceBlock,
        buttonContainer
    );
};

addExperienceButton.addEventListener(
    "click",
    (event) => {
        event.preventDefault();
        createExperienceFields();
    }
);

experienceForm.addEventListener(
    "click",
    (event) => {
        const deleteButton =
            event.target.closest(".delBtn");

        if (!deleteButton) {
            return;
        }

        event.preventDefault();

        const experienceBlock =
            deleteButton.closest(
                ".experience-entry"
            );

        if (experienceBlock) {
            experienceBlock.remove();
        }
    }
);

document
    .getElementById("experiance")
    .addEventListener("panelactive", async () => {
        if (experiencesLoaded) {
            return;
        }

        try {
            const response = await fetch(
                `${domain}/api/doctor/getexperience`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`
                    }
                }
            );

            /*
             * Experience response:
             *
             * {
             *     status: "SUCCESS",
             *     data: [...]
             * }
             */
            const result = await response.json();

            if (!response.ok) {
                showError(
                    result.message ||
                    "Unable to get experience details."
                );

                return;
            }

            const experiences =
                Array.isArray(result.data)
                    ? result.data
                    : [];

            if (experiences.length === 0) {
                experiencesLoaded = true;
                return;
            }

            const firstExperience =
                experiences[0];

            document.getElementById(
                "exp_facility_1"
            ).value =
                firstExperience.facilityName || "";

            document.getElementById(
                "exp_designation_1"
            ).value =
                firstExperience.designation || "";

            document.getElementById(
                "start_1"
            ).value =
                formatDateForInput(
                    firstExperience.startDate
                );

            document.getElementById(
                "end_1"
            ).value =
                formatDateForInput(
                    firstExperience.endDate
                );

            experiences
                .slice(1)
                .forEach((experience) => {
                    createExperienceFields(
                        experience
                    );
                });

            experiencesLoaded = true;
        } catch (error) {
            showError(error.message);
        }
    });

experienceForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        if (!experienceForm.checkValidity()) {
            experienceForm.reportValidity();
            return;
        }

        const submitButton =
            event.submitter ||
            experienceForm.querySelector(
                '[type="submit"]'
            );

        const experiences = [];

        experiences.push({
            facilityName:
                document
                    .getElementById(
                        "exp_facility_1"
                    )
                    .value.trim(),

            designation:
                document
                    .getElementById(
                        "exp_designation_1"
                    )
                    .value.trim(),

            startDate:
                document.getElementById(
                    "start_1"
                ).value,

            endDate:
                document.getElementById(
                    "end_1"
                ).value
        });

        experienceForm
            .querySelectorAll(
                ".experience-entry"
            )
            .forEach((block) => {
                const number =
                    block.id.replace(
                        "exp_",
                        ""
                    );

                experiences.push({
                    facilityName:
                        document
                            .getElementById(
                                `exp_facility_${number}`
                            )
                            .value.trim(),

                    designation:
                        document
                            .getElementById(
                                `exp_designation_${number}`
                            )
                            .value.trim(),

                    startDate:
                        document.getElementById(
                            `start_${number}`
                        ).value,

                    endDate:
                        document.getElementById(
                            `end_${number}`
                        ).value
                });
            });

        setButtonLoading(
            submitButton,
            true,
            "Saving..."
        );

        await waitForNextPaint();

        try {
            const response = await fetch(
                `${domain}/api/doctor/addexperience`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${getToken()}`
                    },

                    body: JSON.stringify({
                        experiences
                    })
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                showError(
                    data.message ||
                    "Unable to save experience details."
                );

                return;
            }

            alert(
                data.message ||
                "Experience details saved successfully."
            );

            document
                .getElementById("tab4")
                .click();
        } catch (error) {
            showError(error.message);
        } finally {
            setButtonLoading(
                submitButton,
                false
            );
        }
    }
);

/* =========================
   OPERATIONAL DETAILS
========================= */

document
    .getElementById("operational")
    .addEventListener("panelactive", async () => {
        try {
            const response = await fetch(
                `${domain}/api/doctor/get-operationalDetails`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`
                    }
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                showError(
                    data.message ||
                    "Unable to get operational details."
                );

                return;
            }

            document.getElementById("m_cap").value =
                data.morningCapacity ?? "";

            document.getElementById("a_cap").value =
                data.afternoonCapacity ?? "";

            document.getElementById("e_cap").value =
                data.eveningCapacity ?? "";

            const holiday = String(
                data.holidays || ""
            );

            document
                .querySelectorAll(
                    'input[name="holiday"]'
                )
                .forEach(
                    (checkbox, index) => {
                        checkbox.checked =
                            holiday.includes(
                                String(index + 1)
                            );
                    }
                );
        } catch (error) {
            showError(error.message);
        }
    });

document
    .getElementById("btnOps")
    .addEventListener("click", async (event) => {
        event.preventDefault();

        const submitButton = event.currentTarget;
        const currentForm =
            submitButton.closest("form");

        if (!currentForm.checkValidity()) {
            currentForm.reportValidity();
            return;
        }

        const morningCapacity = Number(
            document.getElementById("m_cap").value
        );

        const afternoonCapacity = Number(
            document.getElementById("a_cap").value
        );

        const eveningCapacity = Number(
            document.getElementById("e_cap").value
        );

        const dayMap = {
            Monday: "1",
            Tuesday: "2",
            Wednesday: "3",
            Thursday: "4",
            Friday: "5",
            Saturday: "6",
            Sunday: "7"
        };

        let holidayValue = "";

        document
            .querySelectorAll(
                'input[name="holiday"]:checked'
            )
            .forEach((checkbox) => {
                holidayValue +=
                    dayMap[checkbox.value];
            });

        const holidays =
            holidayValue === ""
                ? 0
                : Number(holidayValue);

        setButtonLoading(
            submitButton,
            true,
            "Saving..."
        );

        await waitForNextPaint();

        try {
            const response = await fetch(
                `${domain}/api/doctor/set-operationalDetails`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${getToken()}`
                    },

                    body: JSON.stringify({
                        morningCapacity,
                        afternoonCapacity,
                        eveningCapacity,
                        holidays
                    })
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                showError(
                    data.message ||
                    "Unable to save operational details."
                );

                return;
            }

            document
                .getElementById("tab5")
                .click();
        } catch (error) {
            showError(error.message);
        } finally {
            setButtonLoading(
                submitButton,
                false
            );
        }
    });

/* =========================
   ABOUT
========================= */

document
    .getElementById("about")
    .addEventListener("panelactive", async () => {
        try {
            const response = await fetch(
                `${domain}/api/doctor/get-about`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`
                    }
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                showError(
                    data.message ||
                    "Unable to get profile details."
                );

                return;
            }

            document.getElementById(
                "designation"
            ).value =
                data.designation || "";

            document.getElementById(
                "desc"
            ).value =
                data.about || "";

            /*
             * File inputs cannot be populated using
             * JavaScript. Display the existing photo
             * through the image element instead.
             */
            if (data.photo) {
                profilePic.src = data.photo;
            }
        } catch (error) {
            showError(error.message);
        }
    });

document
    .getElementById("btnAbout")
    .addEventListener("click", async (event) => {
        event.preventDefault();

        const submitButton = event.currentTarget;
        const currentForm =
            submitButton.closest("form");

        if (!currentForm.checkValidity()) {
            currentForm.reportValidity();
            return;
        }

        const designation =
            document
                .getElementById("designation")
                .value.trim();

        const about =
            document
                .getElementById("desc")
                .value.trim();

        const profileFile =
            document
                .getElementById("pfp")
                .files[0];

        const formData = new FormData();

        formData.append(
            "designation",
            designation
        );

        formData.append(
            "about",
            about
        );

        if (profileFile) {
            formData.append(
                "photo",
                profileFile
            );
        }

        setButtonLoading(
            submitButton,
            true,
            "Saving..."
        );

        await waitForNextPaint();

        try {
            const response = await fetch(
                `${domain}/api/doctor/set-about`,
                {
                    method: "PUT",

                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`
                    },

                    body: formData
                }
            );

            const data =
                await getResponseData(response);

            if (!response.ok) {
                showError(
                    data.message ||
                    "Unable to save profile details."
                );

                return;
            }

            document
                .getElementById("tab6")
                .click();
        } catch (error) {
            showError(error.message);
        } finally {
            setButtonLoading(
                submitButton,
                false
            );
        }
    });

/* =========================
   VERIFICATION RECORDS
========================= */

document
    .getElementById("btnRecords")
    .addEventListener("click", async (event) => {
        event.preventDefault();

        const submitButton = event.currentTarget;
        const currentForm =
            submitButton.closest("form");

        if (!currentForm.checkValidity()) {
            currentForm.reportValidity();
            return;
        }

        const governmentId =
            document
                .getElementById("governmentId")
                .files[0];

        const medicalCertificate =
            document
                .getElementById(
                    "medicalCertificate"
                )
                .files[0];

        if (
            !governmentId ||
            !medicalCertificate
        ) {
            showError(
                "Please upload both documents."
            );

            return;
        }

        const medicalCertForm =
            new FormData();

        medicalCertForm.append(
            "file",
            medicalCertificate
        );

        medicalCertForm.append(
            "title",
            "Medical Certificate"
        );

        medicalCertForm.append(
            "isPublic",
            "true"
        );

        const governmentIdForm =
            new FormData();

        governmentIdForm.append(
            "file",
            governmentId
        );

        governmentIdForm.append(
            "title",
            "Government ID"
        );

        governmentIdForm.append(
            "isPublic",
            "true"
        );

        setButtonLoading(
            submitButton,
            true,
            "Uploading..."
        );

        await waitForNextPaint();

        try {
            /*
             * Upload the medical certificate.
             */
            const medicalResponse = await fetch(
                `${domain}/api/doctor/upload-document`,
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`
                    },

                    body: medicalCertForm
                }
            );

            const medicalData =
                await getResponseData(
                    medicalResponse
                );

            if (!medicalResponse.ok) {
                showError(
                    medicalData.message ||
                    "Unable to upload medical certificate."
                );

                return;
            }

            /*
             * Upload the government ID.
             */
            const governmentResponse =
                await fetch(
                    `${domain}/api/doctor/upload-document`,
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${getToken()}`
                        },

                        body: governmentIdForm
                    }
                );

            const governmentData =
                await getResponseData(
                    governmentResponse
                );

            if (!governmentResponse.ok) {
                showError(
                    governmentData.message ||
                    "Unable to upload government ID."
                );

                return;
            }

            alert(
                governmentData.message ||
                medicalData.message ||
                "Documents uploaded successfully. Please wait while your credentials are verified."
            );
        } catch (error) {
            showError(error.message);
        } finally {
            setButtonLoading(
                submitButton,
                false
            );
        }
    });

/*
 * Show the first panel only after all panelactive
 * event listeners have been registered.
 */
if (tabPanels.length > 0) {
    showPanel(tabPanels[0]);
}