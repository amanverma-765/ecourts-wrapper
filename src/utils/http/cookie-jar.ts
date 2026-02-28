export type Cookie = {
    value: string;
    path?: string;
    domain?: string;
    expires?: Date;
    secure?: boolean;
    httpOnly?: boolean;
};

export class CookieJar {
    private cookies: Record<string, Cookie> = {};

    setCookies(setCookieHeader: string | string[]): void {
        const cookiesArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

        for (const cookieStr of cookiesArray) {
            const parts = cookieStr.split(";").map((p) => p.trim());
            if (parts.length === 0) continue;

            const firstPart = parts[0];
            if (!firstPart) continue;

            // Split on first "=" only — handles values containing "="
            const eqIdx = firstPart.indexOf("=");
            if (eqIdx === -1) continue;

            const key = firstPart.substring(0, eqIdx);
            const value = firstPart.substring(eqIdx + 1);
            if (!key) continue;

            const cookie: Cookie = {value};

            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                if (!part) continue;

                // Split on first "=" only for attributes too
                const attrEqIdx = part.indexOf("=");
                const attr = attrEqIdx === -1 ? part : part.substring(0, attrEqIdx);
                const attrValue = attrEqIdx === -1 ? undefined : part.substring(attrEqIdx + 1);

                switch (attr.toLowerCase()) {
                    case "path":
                        if (attrValue) cookie.path = attrValue;
                        break;
                    case "domain":
                        if (attrValue) cookie.domain = attrValue;
                        break;
                    case "expires":
                        if (attrValue) cookie.expires = new Date(attrValue);
                        break;
                    case "secure":
                        cookie.secure = true;
                        break;
                    case "httponly":
                        cookie.httpOnly = true;
                        break;
                }
            }

            this.cookies[key] = cookie;
        }
    }

    getCookieHeader(): string {
        const now = new Date();
        return Object.entries(this.cookies)
            .filter(([_, cookie]) => !cookie.expires || cookie.expires > now)
            .map(([key, cookie]) => `${key}=${cookie.value}`)
            .join("; ");
    }
}
