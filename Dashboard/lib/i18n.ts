/** Dashboard localization dictionary. Thai prose + English technical terms (team convention):
 *  acronyms / product names (VRAM, GPU, L1/L2/L3, gateway, pipeline, Redis…) stay English in both. */

export type Lang = "en" | "th";

export const DICT: Record<string, { en: string; th: string }> = {
  "brand.sub": { en: "mission control", th: "ศูนย์ควบคุม" },
  "nav.overview": { en: "Overview", th: "ภาพรวม" },
  "rail.standalone": { en: "standalone · local", th: "standalone · local" },

  "overview.title": { en: "System overview", th: "ภาพรวมระบบ" },
  "overview.subtitle": { en: "Frontend ↔ Backend ↔ MIT · live", th: "Frontend ↔ Backend ↔ MIT · สด" },
  "overview.mitDown": { en: "MIT translator down", th: "MIT translator ล่ม" },
  "overview.telemetry": { en: "Telemetry · MIT host", th: "ค่าวัด · MIT host" },

  "flow.title": { en: "Request flow", th: "การไหลของ request" },
  "flow.breakPre": { en: "Break at", th: "ติดที่" },
  "flow.breakPost": { en: "— 9arm model timeout. Frontend and Backend nominal.", th: "— 9arm model timeout · Frontend และ Backend ปกติ" },

  "pipeline.title": { en: "Translation Pipeline", th: "Pipeline การแปล" },
  "pipeline.stuck": { en: "Stuck at", th: "ติดที่" },
  "pipeline.idle": { en: "Pipeline idle", th: "Pipeline ว่าง" },

  "subsystems.title": { en: "Subsystems", th: "ระบบย่อย" },
  "traffic.title": { en: "Traffic", th: "ทราฟฟิก" },
  "traffic.activeUsers": { en: "Active users", th: "ผู้ใช้ออนไลน์" },
  "traffic.totalUsers": { en: "Total users", th: "ผู้ใช้ทั้งหมด" },
  "traffic.totalBandwidth": { en: "Total bandwidth", th: "Bandwidth รวม" },
  "traffic.byService": { en: "Bandwidth by service", th: "Bandwidth ราย service" },
  "incident.title": { en: "Incident summary", th: "สรุป incident" },
  "queue.title": { en: "Translate queue", th: "คิวการแปล" },
  "gateway.title": { en: "Gateway diagnosis", th: "วินิจฉัย gateway" },
  "timing.title": { en: "Stage timing vs baseline", th: "เวลา stage เทียบ baseline" },
  "quality.title": { en: "Translation quality", th: "คุณภาพการแปล" },
  "liveactivity.title": { en: "Live activity", th: "กิจกรรมสด" },
};

export function translate(lang: Lang, key: string): string {
  return DICT[key]?.[lang] ?? key;
}
