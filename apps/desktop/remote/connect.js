const form = document.querySelector("form");
const address = document.querySelector("#address");
const status = document.querySelector("#status");
const button = document.querySelector("button");
window.connection.read().then((config) => {
  address.value = config.url || "";
  status.textContent = config.error || "";
  if (config.disabled) button.disabled = true;
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = "";
  try {
    const result = await window.connection.connect(address.value);
    if (result.error) status.textContent = result.error;
  } catch {
    status.textContent = "Could not connect. Check your VPN and workspace address, then try again.";
  } finally {
    button.disabled = false;
  }
});
