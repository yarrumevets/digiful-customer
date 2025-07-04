const orderId = location.pathname.split("/").pop();
const urlsList = document.getElementById("urls-list");
const pageTitle = document.getElementById("page-title");
const orderNumberText = document.createElement("span");
const basePath = document.querySelector("base")?.href;
pageTitle.appendChild(orderNumberText);
orderNumberText.innerHTML = `Order #${orderId}`;
fetch(`${basePath}/api/getsignedorderurls/${orderId}`)
  .then((r) => r.json())
  .then(({ urls }) => {
    urls.forEach((u) => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${u}" alt="${u}">Download - ${u}</a>`;
      urlsList.appendChild(li);
    });
  })
  .catch(() => (document.body.textContent = "Error loading files"));
