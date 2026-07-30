const APP_ID = localStorage.getItem("agoraAppId");
const TOKEN = localStorage.getItem("conferenceToken");
const CHANNEL = localStorage.getItem("conferenceChannel");

const client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8"
});

let localTracks = [];
let remoteUsers = {};

const joinAndDisplayLocalStream = async () => {
    client.on("user-published", handleUserJoined);
    client.on("user-left", handleUserLeft);

    if (!APP_ID || !TOKEN || !CHANNEL) {
        throw new Error(
            "Conference credentials are missing. " +
            "Join again from the dashboard."
        );
    }

    const UID = await client.join(
        APP_ID,
        CHANNEL,
        TOKEN,
        null
    );

    localTracks =
        await AgoraRTC.createMicrophoneAndCameraTracks();

    const player = `
        <div
            class="video-container"
            id="user-container-${UID}"
        >
            <div
                class="video-player"
                id="user-${UID}"
            ></div>
        </div>
    `;

    document
        .getElementById("video-stream")
        .insertAdjacentHTML("beforeend", player);

    localTracks[1].play(`user-${UID}`);

    await client.publish([
        localTracks[0],
        localTracks[1]
    ]);
};

const joinStream = async () => {
    try {
        await joinAndDisplayLocalStream();

        document.getElementById("join-panel").hidden = true;

        document.getElementById(
            "stream-wrapper"
        ).hidden = false;

        document.getElementById(
            "room-status"
        ).textContent = "Consultation live";
    } catch (error) {
        console.error("Could not join stream:", error);

        document.getElementById(
            "conference-error"
        ).textContent = error.message;
    }
};

const handleUserJoined = async (user, mediaType) => {
    remoteUsers[user.uid] = user;

    await client.subscribe(user, mediaType);

    if (mediaType === "video") {
        let player = document.getElementById(
            `user-container-${user.uid}`
        );

        if (player !== null) {
            player.remove();
        }

        player = `
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
            .insertAdjacentHTML("beforeend", player);

        user.videoTrack.play(`user-${user.uid}`);
    }

    if (mediaType === "audio") {
        user.audioTrack.play();
    }
};

const handleUserLeft = async (user) => {
    delete remoteUsers[user.uid];

    document
        .getElementById(`user-container-${user.uid}`)
        ?.remove();
};

const leaveAndRemoveLocalStream = async () => {
    for (let index = 0; index < localTracks.length; index++) {
        localTracks[index].stop();
        localTracks[index].close();
    }

    await client.leave();

    document.getElementById("join-panel").hidden = false;

    document.getElementById(
        "stream-wrapper"
    ).hidden = true;

    document.getElementById(
        "room-status"
    ).textContent = "Consultation ended";

    document.getElementById("video-stream").innerHTML = "";
};

const toggleMic = async (event) => {
    if (localTracks[0].muted) {
        await localTracks[0].setMuted(false);

        event.target.innerText = "Mute microphone";
    } else {
        await localTracks[0].setMuted(true);

        event.target.innerText = "Unmute microphone";
    }
};

const toggleCam = async (event) => {
    if (localTracks[1].muted) {
        await localTracks[1].setMuted(false);

        event.target.innerText = "Turn camera off";
    } else {
        await localTracks[1].setMuted(true);

        event.target.innerText = "Turn camera on";
    }
};

document
    .getElementById("join-btn")
    .addEventListener("click", joinStream);

document
    .getElementById("leave-btn")
    .addEventListener(
        "click",
        leaveAndRemoveLocalStream
    );

document
    .getElementById("mic-btn")
    .addEventListener("click", toggleMic);

document
    .getElementById("cam-btn")
    .addEventListener("click", toggleCam);