try {
    const uiRes = await fetch("http://localhost:3010/health");
    console.log("UI Status:", uiRes.status);
} catch (e: any) {
    console.log("UI Failed:", e.message);
}

try {
    const apiRes = await fetch("http://localhost:3020/health");
    console.log("API Status:", apiRes.status);
} catch (e: any) {
    console.log("API Failed:", e.message);
}
