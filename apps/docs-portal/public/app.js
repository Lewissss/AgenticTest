let index;
let documents = [];

async function buildIndex() {
    const res = await fetch("/assets/search-index.json");
    const payload = await res.json();
    documents = payload.docs;
    index = window.lunr(function () {
        this.ref("id");
        this.field("title");
        this.field("body");
        payload.docs.forEach((doc) => this.add(doc));
    });
}

async function initSearchModal() {
    await buildIndex();
    document.body.dataset.searchReady = "true";
    const modal = document.getElementById("search-modal");
    const input = document.getElementById("search-input");
    const resultsList = document.getElementById("search-results");
    const open = () => {
        modal.hidden = false;
        input.value = "";
        input.focus();
        resultsList.innerHTML = "";
    };
    const close = () => {
        modal.hidden = true;
    };

    document.getElementById("search-button").addEventListener("click", open);
    document.getElementById("search-close").addEventListener("click", close);

    document.addEventListener("keydown", (event) => {
        if (event.key === "/" && document.activeElement.tagName !== "INPUT") {
            event.preventDefault();
            open();
        }
        if (event.key === "Escape") {
            close();
        }
        if (["j", "k"].includes(event.key.toLowerCase())) {
            event.preventDefault();
            const headings = Array.from(document.querySelectorAll("main h2, main h3"));
            const current = document.activeElement;
            const idx = headings.indexOf(current);
            const nextIdx = event.key.toLowerCase() === "j" ? idx + 1 : idx - 1;
            headings[nextIdx]?.scrollIntoView({ behavior: "smooth", block: "center" });
            headings[nextIdx]?.focus();
        }
    });

    input.addEventListener("input", () => {
        const query = input.value.trim();
        if (!query) {
            resultsList.innerHTML = "";
            return;
        }
        const hits = index.search(query).slice(0, 5);
        resultsList.innerHTML = hits
            .map((hit) => {
                const doc = documents.find((d) => d.id === hit.ref);
                return `<li data-testid="search-result"><a href="${doc.url}"><strong>${doc.title}</strong><p>${doc.preview}</p></a></li>`;
            })
            .join("");
    });
}

initSearchModal();
