# Mobile Architecture and Integration

> **Phase 3 — Future Scaling Goal**
> Mobile App อยู่ในแผน Phase 3 และยังไม่ได้ integrate เข้า production pipeline ของ MangaDock โค้ด shell ใน `Mobile/` คือ proof-of-concept สำหรับวางโครงสร้างล่วงหน้า

เอกสารฉบับนี้สรุปบทบาทของ Mobile Application ในระบบ MangaDock และแนวทางการเชื่อมต่อกับส่วนอื่น ๆ

## 1. Mobile Overview

Mobile Application ของ MangaDock วางแผนพัฒนาด้วย **React Native** โดยเน้นการเป็น **Native Shell** ที่ครอบ Web Application (Next.js) ไว้ภายใน WebView เพื่อใช้ประโยชน์จาก Responsive Design ที่ทำไว้แล้ว และเสริมความสามารถด้วยฟีเจอร์ที่เข้าถึงระบบปฏิบัติการ (OS-Level Integration)

### 1.2 Tech Stack
*   **Framework:** React Native 0.85+ (TypeScript)
*   **Component:** react-native-webview
*   **Security:** Native Hardware ID (Android ID / IDFV)
*   **Advanced APIs:** MediaProjection API (Screen Capture), WindowManager (UI Overlay)

## 2. Main Responsibilities

แอปพลิเคชันมือถือรับผิดชอบงานหลักดังนี้

1. แสดงผลหน้าเว็บ MangaDock ผ่าน WebView พร้อมปรับแต่งประสบการณ์ให้เหมือน Native App
2. จัดการ Native Hardware ID เพื่อส่งแนบไปกับ Header `x-hardware-id` (Zero-Trust)
3. เตรียมโครงสร้างสำหรับระบบ **Real-time Screen Translation**
4. จัดการระบบ Deep Linking สำหรับการ Authentication ข้ามแอป

## 3. High-Level Architecture

```text
User Mobile Device
  -> React Native App (Shell)
      -> WebView (MangaDock Web App)
      -> Native Modules (Java/Kotlin)
          -> Screen Capture API
          -> Window Overlay API
```

## 4. Key Integrations

### 4.1 Web App Integration
แอปมือถือจะโหลด URL ของเว็บแอป (เช่น `https://mangadock.com` หรือ Local IP ในช่วงพัฒนา) และสื่อสารผ่าน:
*   **User-Agent:** มีการต่อท้ายด้วย `MangaDockMobile/{OS}`
*   **Custom Headers:** ส่ง `x-hardware-id` และ `x-manga-dock-client`

### 4.2 Auth Bridge
ใช้ระบบ Deep Linking (เช่น `mangadock://auth-callback`) เพื่อรับ Session Token จากเบราว์เซอร์กลับมายังแอปมือถือเมื่อผู้ใช้ทำการ Social Login สำเร็จ

### 4.3 OS-Level Integration (Phase 3 Goal)
*   **Screen Capture:** ใช้ `MediaProjection` เพื่อดึงภาพหน้าจอขณะผู้ใช้ใช้งานแอปอื่น
*   **Overlay:** ใช้ `WindowManager` เพื่อวาดกรอบคำแปลทับซ้อนหน้าจอเดิม

## 5. Development Notes

*   **Android Development:** ต้องการ Android Studio และ Android SDK 34+
*   **iOS Development:** ต้องการ macOS และ Xcode (หากต้องการรันบน iPhone)
*   **Local Testing:** หากรันบน Emulator Android ให้ใช้ URL `http://10.0.2.2:4000` เพื่อเข้าถึงเว็บแอปที่รันบนเครื่อง Host

## 6. Summary

Mobile App เป็นจิกซอว์ชิ้นสุดท้ายที่เปลี่ยนจากเว็บอ่านมังงะธรรมดา ให้กลายเป็นเครื่องมืออัจฉริยะที่สามารถแปลหน้าจอได้แบบเรียลไทม์ โดยยังคงรักษาความเร็วในการพัฒนาจากการใช้ Web-based UI เป็นหลัก
