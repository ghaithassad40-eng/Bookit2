import type { Plugin } from "vite";
interface PluginEnv {
    MYFATOORAH_API_KEY: string;
    MYFATOORAH_BASE_URL: string;
    MYFATOORAH_RETURN_BASE: string;
}
export interface MyFatoorahDevOptions {
    /** Override env loaded from .env.local. */
    env?: Partial<PluginEnv>;
}
export declare function myfatoorahDevProxy(opts?: MyFatoorahDevOptions): Plugin;
export {};
