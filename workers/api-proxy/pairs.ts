export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const backend = env.BACKEND_URL || "http://localhost:3000";
    const path = url.pathname.replace("/cf/pairs", "/api/pairs");
    const newUrl = new URL(path, backend);
    const newReq = new Request(newUrl.toString(), request);
    return fetch(newReq);
  }
};
