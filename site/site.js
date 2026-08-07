const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".site-header nav");

menuButton?.addEventListener("click", () => {
  const open = navigation?.classList.toggle("nav-open") ?? false;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});

navigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navigation.classList.remove("nav-open");
    menuButton?.setAttribute("aria-expanded", "false");
    menuButton?.setAttribute("aria-label", "Open menu");
  });
});

const demoButton = document.querySelector(".studio-controls button");
demoButton?.addEventListener("click", () => {
  const isPaused = demoButton.getAttribute("aria-label") === "Play demo";
  demoButton.setAttribute("aria-label", isPaused ? "Pause demo" : "Play demo");
  demoButton.classList.toggle("is-paused", !isPaused);
});
