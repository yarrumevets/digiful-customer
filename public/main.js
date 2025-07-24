const titleText = window.config.pageTitle;
const pageTitle = document.getElementById("page-title");
pageTitle.innerHTML = titleText;
document.title = titleText;

// Get VM ID via health check
const getVmId = async () => {
  const vmId = document.createElement("p");
  vmId.style.position = "fixed";
  vmId.style.bottom = "10px";
  vmId.style.right = "10px";
  vmId.style.color = "#f00";
  document.body.appendChild(vmId);
  const response = await fetch("./health", {
    method: "GET",
  }).catch((err) => console.error("Error doing health check: ", err));
  const jsonResponse = await response.json();
  vmId.innerHTML = `❤️‍🩹 ${jsonResponse.vmId}`;
};
getVmId();
