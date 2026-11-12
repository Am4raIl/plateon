// Apply a saved theme before the app loads, avoiding a flash on refresh.
try {
  const theme = localStorage.getItem("plateon.theme");
  document.documentElement.dataset.theme =
    theme === "light" || theme === "dark" ? theme : "default";
} catch {
  document.documentElement.dataset.theme = "default";
}
