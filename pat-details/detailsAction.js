import { domain } from "../config.js";

const profilePic = document.querySelector("#about img");
const inputFile = document.querySelector("#pfp");

inputFile.addEventListener("change", () => {
    const file = inputFile.files[0];

    if (!file) {
        return;
    }

    profilePic.src = URL.createObjectURL(file);
});

const getStoredUser = () => {
    return {
        name: localStorage.getItem("name"),
        userId: localStorage.getItem("userId"),
        role: localStorage.getItem("role"),
        token: localStorage.getItem("token")
    };
};

const showError = (message) => {
    console.error(message);
    alert(message);
};

// try{
//     const response = await fetch(
//         `${domain}/api/patient/update-profile`,
//         {
//             method: "PUT",
//             headers: {
//                 Authorization: `Bearer ${localStorage.getItem("token")}`
//             }
//         }
//     );

//     const data = await response.json();

//     if (response.ok) {
//         const gender = document.getElementById("gender").value = data.gender;
//         const dob = document.getElementById("dob").value = data.dob;
//         const phone = document.getElementById("phone").value = data.phone;
//         const address = document.getElementById("address").value = data.address;
//         const profileImage = document.querySelector("#about img");
//         if (data.photo) {
//             profileImage.src = data.photo;
//         }
//     } else {
//         showError(data.message || "Unable to get profile details");
//     }
// }catch(error){
//     showError(error.message);
// }

document.getElementById("btnAbout").addEventListener("click", async (e) => {
    e.preventDefault();

    const form = e.target.closest("form");

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const gender = document.getElementById("gender").value.trim();
    const dob = document.getElementById("dob").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const address = document.getElementById("address").value.trim();
    const profileFile = document.getElementById("pfp").files[0];

    const formData = new FormData();

    formData.append("gender", gender);
    formData.append("dob", dob);
    formData.append("phone", phone);
    formData.append("address", address);

    if (profileFile) {
        formData.append("photo", profileFile);
    }

    try {
        const response = await fetch(
            `${domain}/api/patient/profile`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                },
                body: formData
            }
        );

        const data = await response.json();

        if (response.ok) {
            globalThis.location.href = "../home/home.html";
        } else {
            showError(data.message || "Unable to save profile details");
        }
    } catch (error) {
        showError(error.message);
    }
});

