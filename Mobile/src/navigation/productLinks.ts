import {URL} from 'react-native-url-polyfill';

/** Product destinations only. Auth callbacks retain their own handler. */
export function productLinkPath(link: string): string | null {
  try {
    if (link.includes('\\') || Array.from(link).some(c => c.charCodeAt(0) < 32)) return null;
    if (link.split(/[?#]/)[0].split('/').some(part => ['.', '..'].includes(decodeURIComponent(part)))) return null;
    const url = new URL(link);
    if (url.protocol !== 'mangadock:' || url.username || url.password || url.port) return null;
    const path = `/${url.hostname}${url.pathname}`.replace(/\/$/, '');
    if (/^\/(feed|collections)$/.test(path)) return path;
    if (/^\/collections\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(path)) return path;
    if (/^\/(book|community\/(p|profile|manga))\/[A-Za-z0-9_-]+$/.test(path)) return path;
    if (/^\/(mylist|search|community|studio(?:\/(wallet|works))?|settings(?:\/(profile|password|accounts|security|stats|notifications|danger))?)$/.test(path)) return path;
    return null;
  } catch {return null;}
}
