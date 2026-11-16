/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
interface ImportMetaEnv {
  /** 배포 사이트 주소 (선택). 예: https://school-quest.netlify.app */
  readonly VITE_SITE_URL?: string;
}
declare module '*.md?raw' {
  const text: string;
  export default text;
}
