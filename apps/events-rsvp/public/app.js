const grid = document.getElementById("events-grid");
const modal = document.getElementById("event-modal");
const toast = modal.querySelector('[data-field="toast"]');
const nameInput = modal.querySelector('[data-field="name-input"]');
const emailInput = modal.querySelector('[data-field="email-input"]');
let selectedEvent = null;

async function loadEvents() {
    const res = await fetch("/api/events");
    const events = await res.json();
    document.getElementById("events-count").textContent = `${events.length} events`;
    grid.innerHTML = events
        .map(
            (event) => `
        <article class="event-card" data-testid="event-card" data-event="${event.id}">
            <p class="eyebrow">${event.location}</p>
            <h3>${event.title}</h3>
            <p class="muted">${event.date} · ${event.time}</p>
            <p>${event.description}</p>
            <button data-testid="view-event" data-event="${event.id}">View & RSVP</button>
        </article>
    `
        )
        .join("");

    grid.querySelectorAll("button[data-event]").forEach((btn) => {
        btn.addEventListener("click", () => openModal(events.find((e) => e.id === btn.dataset.event)));
    });

    document.getElementById("open-all").addEventListener("click", () => {
        if (events[0]) openModal(events[0]);
    });
}

function openModal(event) {
    selectedEvent = event;
    modal.querySelector('[data-field="tag"]').textContent = event.tags.join(" · ");
    modal.querySelector('[data-field="title"]').textContent = event.title;
    modal.querySelector('[data-field="meta"]').textContent = `${event.date} · ${event.time} · ${event.location}`;
    modal.querySelector('[data-field="description"]').textContent = event.description;
    toast.textContent = "";
    nameInput.value = "";
    emailInput.value = "";
    modal.showModal();
}

modal.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
        eventId: selectedEvent?.id,
        name: nameInput.value.trim(),
        email: emailInput.value.trim()
    };
    const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    toast.textContent = data.ok ? data.message : data.error;
});

document.getElementById("close-modal").addEventListener("click", () => modal.close());

loadEvents();
