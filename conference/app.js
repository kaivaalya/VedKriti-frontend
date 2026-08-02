/* =========================================================
   CONFERENCE CREDENTIALS
========================================================= */

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

/* =========================================================
   AGORA CLIENT
========================================================= */

const client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8"
});

let localTracks = [];

const remoteUsers = {};

let eventListenersRegistered = false;
let isJoined = false;

/*
 * "contain" preserves the entire video frame.
 * It may produce black bars when the camera ratio
 * does not match the 16:9 container.
 */
const LOCAL_VIDEO_OPTIONS = {
    fit: "contain",
    mirror: true
};

const REMOTE_VIDEO_OPTIONS = {
    fit: "contain",
    mirror: false
};

/* =========================================================
   DOM ELEMENTS
========================================================= */

const joinButton =
    document.getElementById("join-btn");

const leaveButton =
    document.getElementById("leave-btn");

const microphoneButton =
    document.getElementById("mic-btn");

const cameraButton =
    document.getElementById("cam-btn");

const joinPanel =
    document.getElementById("join-panel");

const streamWrapper =
    document.getElementById("stream-wrapper");

const videoStream =
    document.getElementById("video-stream");

const errorElement =
    document.getElementById("conference-error");

const roomStatusElement =
    document.getElementById("room-status");

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

const showConferenceError = (message = "") => {
    errorElement.textContent = message;
};

const setRoomStatus = (message) => {
    roomStatusElement.textContent = message;
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

const createVideoContainer = (uid) => {
    document
        .getElementById(`user-container-${uid}`)
        ?.remove();

    const container = document.createElement("div");
    container.className = "video-container";
    container.id = `user-container-${uid}`;

    const player = document.createElement("div");
    player.className = "video-player";
    player.id = `user-${uid}`;

    container.appendChild(player);
    videoStream.appendChild(container);

    return player.id;
};

const resetControlButtons = () => {
    microphoneButton.textContent =
        "Mute microphone";

    cameraButton.textContent =
        "Turn camera off";
};

/* =========================================================
   REMOTE USER EVENTS
========================================================= */

const handleUserPublished = async (
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
            const playerId =
                createVideoContainer(user.uid);

            user.videoTrack?.play(
                playerId,
                REMOTE_VIDEO_OPTIONS
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

const handleUserUnpublished = (
    user,
    mediaType
) => {
    if (mediaType === "video") {
        document
            .getElementById(
                `user-container-${user.uid}`
            )
            ?.remove();
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
        handleUserPublished
    );

    client.on(
        "user-unpublished",
        handleUserUnpublished
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
     * UID must match the UID used by the backend
     * when generating the Agora token.
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

        const localPlayerId =
            createVideoContainer(assignedUID);

        localTracks[1].play(
            localPlayerId,
            LOCAL_VIDEO_OPTIONS
        );

        await client.publish(localTracks);
    } catch (error) {
        for (const track of localTracks) {
            track.stop();
            track.close();
        }

        localTracks = [];

        if (isJoined) {
            await client.leave();
            isJoined = false;
        }

        videoStream.innerHTML = "";

        throw error;
    }
};

const joinStream = async () => {
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

        joinPanel.hidden = true;
        streamWrapper.hidden = false;

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

        videoStream.innerHTML = "";

        streamWrapper.hidden = true;
        joinPanel.hidden = false;

        resetControlButtons();

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
   MICROPHONE CONTROL
========================================================= */

const toggleMic = async () => {
    const microphoneTrack =
        localTracks[0];

    if (!microphoneTrack) {
        showConferenceError(
            "Microphone is not available."
        );

        return;
    }

    try {
        showConferenceError("");

        const shouldMute =
            !microphoneTrack.muted;

        await microphoneTrack.setMuted(
            shouldMute
        );

        microphoneButton.textContent =
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

/* =========================================================
   CAMERA CONTROL
========================================================= */

const toggleCam = async () => {
    const cameraTrack =
        localTracks[1];

    if (!cameraTrack) {
        showConferenceError(
            "Camera is not available."
        );

        return;
    }

    try {
        showConferenceError("");

        const shouldMute =
            !cameraTrack.muted;

        await cameraTrack.setMuted(
            shouldMute
        );

        cameraButton.textContent =
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

joinButton.addEventListener(
    "click",
    joinStream
);

leaveButton.addEventListener(
    "click",
    leaveAndRemoveLocalStream
);

microphoneButton.addEventListener(
    "click",
    toggleMic
);

cameraButton.addEventListener(
    "click",
    toggleCam
);

/*
 * Stop hardware tracks if the user closes
 * or reloads the page.
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