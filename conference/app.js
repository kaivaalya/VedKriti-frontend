const APP_ID =
    localStorage.getItem("agoraAppId")?.trim();

const TOKEN =
    localStorage.getItem("conferenceToken")?.trim();

const CHANNEL =
    localStorage.getItem("conferenceChannel")?.trim();

const storedUID =
    localStorage.getItem("conferenceUid");

const UID =
    storedUID === null
        ? null
        : Number(storedUID);

const client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8"
});

let localTracks = [];
const remoteUsers = {};

let eventListenersRegistered = false;
let isJoined = false;

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

const showConferenceError = (message = "") => {
    const errorElement =
        document.getElementById("conference-error");

    if (errorElement) {
        errorElement.textContent = message;
    }
};

const setRoomStatus = (message) => {
    const statusElement =
        document.getElementById("room-status");

    if (statusElement) {
        statusElement.textContent = message;
    }
};

const setButtonLoading = (
    button,
    loadingText,
    isLoading
) => {
    if (!button) {
        return;
    }

    if (isLoading) {
        button.dataset.originalText =
            button.textContent;

        button.disabled = true;
        button.textContent = loadingText;
    } else {
        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            button.textContent;

        delete button.dataset.originalText;
    }
};

const validateCredentials = () => {
    if (!APP_ID) {
        throw new Error(
            "Agora App ID is missing. Join again from the dashboard."
        );
    }

    if (!TOKEN) {
        throw new Error(
            "Agora token is missing. Join again from the dashboard."
        );
    }

    if (!CHANNEL) {
        throw new Error(
            "Agora channel name is missing. Join again from the dashboard."
        );
    }

    if (
        UID === null ||
        !Number.isInteger(UID) ||
        UID <= 0
    ) {
        throw new Error(
            "Agora UID is missing or invalid. Join again from the dashboard."
        );
    }
};

/* =========================================================
   REMOTE USER EVENTS
========================================================= */

const handleUserJoined = async (
    user,
    mediaType
) => {
    try {
        remoteUsers[user.uid] = user;

        await client.subscribe(
            user,
            mediaType
        );

        if (mediaType === "video") {
            document
                .getElementById(
                    `user-container-${user.uid}`
                )
                ?.remove();

            const player = `
                <div
                    class="video-container"
                    id="user-container-${user.uid}"
                >
                    <div
                        class="video-player"
                        id="user-${user.uid}"
                    ></div>
                </div>
            `;

            document
                .getElementById("video-stream")
                .insertAdjacentHTML(
                    "beforeend",
                    player
                );

            user.videoTrack?.play(
                `user-${user.uid}`
            );
        }

        if (mediaType === "audio") {
            user.audioTrack?.play();
        }
    } catch (error) {
        console.error(
            "Could not subscribe to remote user:",
            error
        );

        showConferenceError(
            "Could not load the other participant's media."
        );
    }
};

const handleUserLeft = (user) => {
    delete remoteUsers[user.uid];

    document
        .getElementById(
            `user-container-${user.uid}`
        )
        ?.remove();
};

const registerClientEvents = () => {
    if (eventListenersRegistered) {
        return;
    }

    client.on(
        "user-published",
        handleUserJoined
    );

    client.on(
        "user-left",
        handleUserLeft
    );

    eventListenersRegistered = true;
};

/* =========================================================
   JOIN CONFERENCE
========================================================= */

const joinAndDisplayLocalStream = async () => {
    validateCredentials();
    registerClientEvents();

    /*
     * UID must be the same UID used by the backend
     * while generating the Agora token.
     *
     * Doctor  -> UID 1
     * Patient -> UID 2
     */
    const assignedUID = await client.join(
        APP_ID,
        CHANNEL,
        TOKEN,
        UID
    );

    isJoined = true;

    try {
        localTracks =
            await AgoraRTC
                .createMicrophoneAndCameraTracks();

        const player = `
            <div
                class="video-container"
                id="user-container-${assignedUID}"
            >
                <div
                    class="video-player"
                    id="user-${assignedUID}"
                ></div>
            </div>
        `;

        document
            .getElementById("video-stream")
            .insertAdjacentHTML(
                "beforeend",
                player
            );

        localTracks[1].play(
            `user-${assignedUID}`
        );

        await client.publish(localTracks);
    } catch (error) {
        /*
         * If camera or microphone creation fails after
         * joining, leave the channel before rethrowing.
         */
        if (isJoined) {
            await client.leave();
            isJoined = false;
        }

        throw error;
    }
};

const joinStream = async () => {
    const joinButton =
        document.getElementById("join-btn");

    if (isJoined) {
        return;
    }

    showConferenceError("");

    setButtonLoading(
        joinButton,
        "Joining...",
        true
    );

    setRoomStatus(
        "Joining consultation..."
    );

    try {
        await joinAndDisplayLocalStream();

        document
            .getElementById("join-panel")
            .hidden = true;

        document
            .getElementById("stream-wrapper")
            .hidden = false;

        setRoomStatus(
            "Consultation live"
        );
    } catch (error) {
        console.error(
            "Could not join stream:",
            error
        );

        showConferenceError(
            error.message ||
            "Could not join the consultation."
        );

        setRoomStatus(
            "Unable to join consultation"
        );
    } finally {
        setButtonLoading(
            joinButton,
            "Joining...",
            false
        );
    }
};

/* =========================================================
   LEAVE CONFERENCE
========================================================= */

const leaveAndRemoveLocalStream = async () => {
    const leaveButton =
        document.getElementById("leave-btn");

    setButtonLoading(
        leaveButton,
        "Leaving...",
        true
    );

    showConferenceError("");

    try {
        for (const track of localTracks) {
            track.stop();
            track.close();
        }

        localTracks = [];

        if (isJoined) {
            await client.leave();
            isJoined = false;
        }

        Object.keys(remoteUsers)
            .forEach((uid) => {
                delete remoteUsers[uid];
            });

        document
            .getElementById("video-stream")
            .innerHTML = "";

        document
            .getElementById("join-panel")
            .hidden = false;

        document
            .getElementById("stream-wrapper")
            .hidden = true;

        setRoomStatus(
            "Consultation ended"
        );
    } catch (error) {
        console.error(
            "Could not leave conference:",
            error
        );

        showConferenceError(
            error.message ||
            "Could not leave the consultation."
        );
    } finally {
        setButtonLoading(
            leaveButton,
            "Leaving...",
            false
        );
    }
};

/* =========================================================
   MICROPHONE AND CAMERA CONTROLS
========================================================= */

const toggleMic = async (event) => {
    const microphoneTrack =
        localTracks[0];

    if (!microphoneTrack) {
        showConferenceError(
            "Microphone is not available."
        );

        return;
    }

    try {
        const shouldMute =
            !microphoneTrack.muted;

        await microphoneTrack.setMuted(
            shouldMute
        );

        event.currentTarget.textContent =
            shouldMute
                ? "Unmute microphone"
                : "Mute microphone";
    } catch (error) {
        console.error(
            "Could not change microphone state:",
            error
        );

        showConferenceError(
            "Could not change the microphone state."
        );
    }
};

const toggleCam = async (event) => {
    const cameraTrack =
        localTracks[1];

    if (!cameraTrack) {
        showConferenceError(
            "Camera is not available."
        );

        return;
    }

    try {
        const shouldMute =
            !cameraTrack.muted;

        await cameraTrack.setMuted(
            shouldMute
        );

        event.currentTarget.textContent =
            shouldMute
                ? "Turn camera on"
                : "Turn camera off";
    } catch (error) {
        console.error(
            "Could not change camera state:",
            error
        );

        showConferenceError(
            "Could not change the camera state."
        );
    }
};

/* =========================================================
   EVENT LISTENERS
========================================================= */

document
    .getElementById("join-btn")
    .addEventListener(
        "click",
        joinStream
    );

document
    .getElementById("leave-btn")
    .addEventListener(
        "click",
        leaveAndRemoveLocalStream
    );

document
    .getElementById("mic-btn")
    .addEventListener(
        "click",
        toggleMic
    );

document
    .getElementById("cam-btn")
    .addEventListener(
        "click",
        toggleCam
    );

/*
 * Close tracks if the user closes or refreshes the page.
 * client.leave() cannot reliably be awaited during unload.
 */
window.addEventListener(
    "beforeunload",
    () => {
        for (const track of localTracks) {
            track.stop();
            track.close();
        }
    }
);