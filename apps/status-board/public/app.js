const STATUS_COLORS = {
    up: "pill up",
    partial: "pill partial",
    down: "pill down"
};

const DOT_CLASSES = {
    maintenance: "dot maintenance",
    minor: "dot minor",
    major: "dot major"
};

async function fetchStatus() {
    const res = await fetch("status.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load status");
    return res.json();
}

function renderSummary(summary) {
    const summaryEl = document.getElementById("summary-uptime");
    summaryEl.querySelector("strong").textContent = `${summary.uptime}%`;
}

function renderServices(services) {
    const grid = document.getElementById("service-grid");
    grid.innerHTML = "";
    const template = document.getElementById("service-card-template");

    services.forEach((service) => {
        const node = template.content.cloneNode(true);
        node.querySelector('[data-field="name"]').textContent = service.name;
        node.querySelector('[data-field="description"]').textContent = service.description;
        const pill = node.querySelector('[data-field="status"]');
        pill.textContent = service.status;
        pill.className = STATUS_COLORS[service.status] || "pill";
        node.querySelector('[data-field="region"]').textContent = service.region;
        node.querySelector('[data-field="sla"]').textContent = service.sla;
        node.querySelector('[data-field="latency"]').textContent = `${service.latency} ms`;
        grid.appendChild(node);
    });
}

function renderTimeline(items) {
    const holder = document.getElementById("timeline");
    holder.innerHTML = "";
    const counter = document.getElementById("incidents-count");
    const active = items.filter((item) => item.severity !== "maintenance").length;
    counter.textContent = active ? `${active} active` : "All clear";

    const template = document.getElementById("timeline-item-template");
    items.forEach((item) => {
        const node = template.content.cloneNode(true);
        node.querySelector('[data-field="severity"]').className = DOT_CLASSES[item.severity] || "dot";
        node.querySelector('[data-field="title"]').textContent = item.title;
        node.querySelector('[data-field="window"]').textContent = item.window;
        node.querySelector('[data-field="body"]').textContent = item.body;
        holder.appendChild(node);
    });
}

async function load() {
    try {
        const data = await fetchStatus();
        renderSummary(data.summary);
        renderServices(data.services);
        renderTimeline(data.timeline);
    } catch (err) {
        alert(err.message);
    }
}

document.getElementById("refresh").addEventListener("click", () => load());

load();
setInterval(load, 60000);
