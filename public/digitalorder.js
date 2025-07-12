const orderId = location.pathname.split("/").pop();
const urlsList = document.getElementById("urls-list");
const pageTitle = document.getElementById("page-title");
const basePath = document.querySelector("base")?.href;
const orderNumberText = document.getElementById("order-number-text");
orderNumberText.innerHTML = `Order: ${orderId}`;
const errorText = document.getElementById("error-text");

const createReadableDisplaySize = (s) => {
  const isOnlyDigits = /^\d+$/.test(s);
  if (!isOnlyDigits) return "(unknown)"; // don't return NaN.
  const size = parseInt(s);
  if (s < 1000) {
    return `${size.toFixed(1)} bytes`;
  } else if (size < 1_000_000) {
    return `${(size / 1000).toFixed(1)} KB`;
  } else if (size < 1_000_000_000) {
    return `${(size / 1_000_000).toFixed(1)} MB`;
  } else {
    // GB is the maximum unit.
    return `${(s / 1_000_000_000).toFixed(1)} GB`;
  }
};

fetch(`/api/getsignedorderurls/${orderId}`)
  .then((r) => r.json())
  .then(({ products }) => {
    products.forEach((p) => {
      const li = document.createElement("li");
      li.innerHTML = `<h3>${
        p.title
      }</h3><ul><li>Size: ${createReadableDisplaySize(
        p.size
      )}</li><li>Version: ${p.version}.0</li>
      <li><a href="${p.url}" alt="${p.title}">Download</a></li></ul>`;
      urlsList.appendChild(li);
    });
  })
  .catch((error) => {
    errorText.classList.remove("hidden");
    errorText.innerHTML =
      "Error loading files - Refresh the page or try again later.";
    console.error("Error loading file files: ", error);
  });
