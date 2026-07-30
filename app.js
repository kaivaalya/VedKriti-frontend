gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

if (!prefersReducedMotion) {
  gsap.from(".hero__content > *", {
    y: 35,
    opacity: 0,
    duration: 0.85,
    stagger: 0.12,
    ease: "power3.out",
  });

  gsap.from(".hero__visual", {
    x: 50,
    opacity: 0,
    duration: 1,
    delay: 0.2,
    ease: "power3.out",
  });

  gsap.utils.toArray(".feature").forEach((feature) => {
    const media = feature.querySelector(".feature__media");
    const content = feature.querySelector(".feature__content");

    gsap.from([media, content], {
      y: 55,
      opacity: 0,
      duration: 0.9,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: {
        trigger: feature,
        start: "top 78%",
        once: true,
      },
    });
  });

  // Horizontal scrolling is used only on screens wider than 768px.
  // On phones, the cards are displayed vertically using CSS.
  const horizontalMedia = gsap.matchMedia();

  horizontalMedia.add("(min-width: 769px)", () => {
    const process = document.querySelector(".process");
    const track = document.querySelector(".process__track");
    const steps = gsap.utils.toArray(".step");

    const getScrollDistance = () =>
      Math.max(0, track.scrollWidth - process.clientWidth);

    const horizontalScroll = gsap.to(track, {
      x: () => -getScrollDistance(),
      ease: "none",

      scrollTrigger: {
        trigger: process,
        start: "top top",
        end: () => `+=${getScrollDistance()}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    steps.slice(1).forEach((step) => {
      gsap.from(step.querySelector(".step__card"), {
        y: 60,
        opacity: 0,
        scale: 0.96,
        ease: "power2.out",

        scrollTrigger: {
          trigger: step,
          containerAnimation: horizontalScroll,
          start: "left 80%",
          end: "left 55%",
          scrub: true,
        },
      });
    });

    return () => {
      gsap.set(track, {
        clearProps: "transform",
      });
    };
  });
}

const goToAuth = (mode) => {
  localStorage.setItem("mode", mode);
  window.location.href = "auth/auth.html";
};

document.getElementById("login").addEventListener("click", () => {
  goToAuth("signin");
});

document.getElementById("create").addEventListener("click", () => {
  goToAuth("create");
});

document.querySelectorAll("[data-create-account]").forEach((button) => {
  button.addEventListener("click", () => {
    goToAuth("create");
  });
});

// Recalculate dimensions after all images have loaded.
window.addEventListener("load", () => {
  ScrollTrigger.refresh();
});