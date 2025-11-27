import React from "react";
import { render } from "ink";
import App from "./ui.js";

export function startTui() {
    const instance = render(<App />);
    return instance.waitUntilExit();
}

export default App;
