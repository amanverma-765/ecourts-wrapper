import {createHttpClient, type HttpClient} from "../utils/http/http-client.ts";

export const ecourtsClient: HttpClient = createHttpClient({
    defaultHeaders: {
        "Host": "app.ecourts.gov.in",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 16; Pixel 7 Build/BP4A.251205.006)",
        "Accept-Encoding": "gzip",
        "Accept-Charset": "UTF-8",
        "Connection": "Keep-Alive",
    },
    timeoutMs: 30_000,
});
