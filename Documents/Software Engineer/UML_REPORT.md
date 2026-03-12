# MangaDock UML Report

เอกสารนี้รวบรวมแผนภาพ UML หลักของโปรเจกต์ MangaDock สำหรับใช้ในรายงานและการนำเสนอวิชา Software Engineering

หมายเหตุสำคัญ:

- UML ไม่ได้มีแค่แบบเดียว ภาพตัวอย่างที่เห็นบ่อยคือ Class Diagram
- สำหรับรายงานระบบนี้ ควรใช้ UML หลัก 5 แบบ คือ Use Case, Class, Sequence, Activity, Deployment
- Mermaid รองรับ UML บางประเภทได้ดีมาก เช่น classDiagram และ sequenceDiagram
- Use Case Diagram ใน Mermaid ยังไม่มี syntax UML โดยตรง จึงต้องวาดแบบจำลองใกล้เคียงหรือใช้ draw.io, StarUML, Lucidchart ถ้าต้องการ notation เป๊ะ 100%

## 1. UML Use Case Diagram

ตัวนี้เป็นเวอร์ชันสำหรับรายงานใน Mermaid ที่สื่อความหมายแบบ Use Case ให้ใกล้เคียง UML มากที่สุด

```mermaid
flowchart LR
  Guest[Guest]
  Member[Member]

  UC1([Browse Home Page])
  UC2([Search Books or Manga])
  UC3([View Book Detail])
  UC4([Read Manga Chapter])
  UC5([Translate Manga Page])
  UC6([Login or Register])
  UC7([Manage Profile])
  UC8([Manage Favorites])
  UC9([Manage Liked Items])
  UC10([Manage Reading History])
  UC11([Validate Email])

  Guest --> UC1
  Guest --> UC2
  Guest --> UC3
  Guest --> UC6

  Member --> UC1
  Member --> UC2
  Member --> UC3
  Member --> UC4
  Member --> UC5
  Member --> UC7
  Member --> UC8
  Member --> UC9
  Member --> UC10

  UC6 -. include .-> UC11
  UC4 -. extend .-> UC3
  UC5 -. extend .-> UC4
```

## 2. UML Component Diagram

```mermaid
flowchart LR
  User([User\nactor])

  NextFrontend[NextFrontend\ncomponent\nHome Page\nSearch Page\nCategories Page\nMy List Page\nAccount Page\nHeroCarousel\nBookDetailModal\nMangaReader]
  NextApiProxy[NextApiProxy\ncomponent\napi/proxy routes\nimg-proxy route]
  NestBackend[NestBackend\ncomponent\nBooksController\nUsersController\nUsersPublicController\nStatusController]

  BooksService[BooksService\nservice]
  UsersService[UsersService\nservice]
  CacheOrchestratorService[CacheOrchestratorService\nservice]
  FirebaseService[FirebaseService\nservice]
  StatusService[StatusService\nservice]

  GoogleBooksAPI[(Google Books API\nexternal)]
  MangaDexAPI[(MangaDex API\nexternal)]
  GeminiAPI[(Gemini API\nexternal)]
  MangaImageTranslator[(Manga Image Translator\nexternal)]
  FirebaseAuth[(Firebase Auth\nexternal)]
  Firestore[(Firestore\ndatabase)]
  Redis[(Redis\ndatabase)]
  JsonCache[(JSON Cache\ndatabase)]
  ImageCache[(Image Cache\ndatabase)]
  UploadStorage[(Upload Storage\ndatabase)]

  User -->|use via browser| NextFrontend
  NextFrontend -->|relative HTTP requests| NextApiProxy
  NextApiProxy -->|server-to-server forwarding| NestBackend

  NestBackend --> BooksService
  NestBackend --> UsersService
  NestBackend --> StatusService

  BooksService -->|metadata and search| GoogleBooksAPI
  BooksService -->|manga detail and chapter pages| MangaDexAPI
  BooksService -->|description and dialogue translation| GeminiAPI
  BooksService -->|page translation and patches| MangaImageTranslator
  BooksService -->|cache lookup and write| CacheOrchestratorService

  UsersService --> FirebaseService
  FirebaseService --> FirebaseAuth
  FirebaseService --> Firestore

  CacheOrchestratorService --> Redis
  CacheOrchestratorService --> JsonCache
  CacheOrchestratorService --> ImageCache
  NestBackend -->|avatars and translated assets| UploadStorage
```

## 3. UML Package or Module Diagram

```mermaid
classDiagram
direction TB

class AppModule {
  +imports CacheModule
  +imports FirebaseModule
  +imports BooksModule
  +imports UsersModule
  +imports StatusModule
}

class CacheModule {
  +RedisService
  +JsonCacheService
  +CacheOrchestratorService
  +ImageCacheService
}

class FirebaseModule {
  +FirebaseService
}

class BooksModule {
  +BooksController
  +BooksService
  +GoogleBooksService
  +MangaDexService
}

class UsersModule {
  +UsersController
  +UsersPublicController
  +UsersService
  +EmailValidationService
}

class StatusModule {
  +StatusController
  +StatusService
}

AppModule --> CacheModule
AppModule --> FirebaseModule
AppModule --> BooksModule
AppModule --> UsersModule
AppModule --> StatusModule
BooksModule --> StatusModule
UsersModule --> FirebaseModule
BooksModule --> CacheModule
```

## 4. UML Class Diagram

ภาพนี้เป็น UML แบบเดียวกับตัวอย่างที่คุณส่งมา และเป็นแผนภาพที่ควรใช้เป็นหลักในรายงาน

```mermaid
classDiagram
direction TB

class BooksController {
  +getLandingBooks()
  +getNewReleases()
  +getGenreManga()
  +getMangaDetail()
  +getMangaPreview()
  +getMangaChapters()
  +getMangaChapterPages()
  +searchBooks()
  +translateDescription()
  +translateMangaEpisode()
  +translateMangaPage()
  +translateMangaPagePatches()
  +batchTranslateMangaPatches()
  +proxyImage()
}

class BooksService {
  +getLandingBooks(forceLocal)
  +getNewReleases(page, limit, tag)
  +getGenreManga(slug, page, limit)
  +getMangaDetail(id, forceLocal)
  +getMangaPreview(id)
  +getMangaChapters(id, forceLocal)
  +getMangaChapterPages(chapterId, forceLocal)
  +searchBooks(query, lang, limit, offset)
  +translateDescription(text)
  +translateMangaEpisode(payload)
  +translateMangaPage(chapterId, pageIndex, pageUrl)
  +translateMangaPagePatches(chapterId, pageIndex, pageUrl, sourceLang, targetLang)
  +startOrAttachBatchJob(chapterId, pages, listener, sourceLang, targetLang)
  +removeBatchListener(chapterId, sourceLang, targetLang, listener)
}

class GoogleBooksService {
  +searchBooks()
  +getNewReleases()
}

class MangaDexService {
  +getMangaDetail()
  +getMangaPreview()
  +getMangaChapters()
  +getChapterPages()
  +searchManga()
}

class CacheOrchestratorService {
  +get(key)
  +set(key, value, ttl)
  +invalidate(key)
}

class ImageCacheService {
  +cacheImage(url)
  +getCachedImage(url)
}

class StatusService {
  +broadcastStatus(service, status)
  +getStatusStream()
}

class UsersController {
  +upsertMe()
  +updateMyProfile()
  +getMe()
  +deleteMe()
  +getFavorites()
  +addFavorite()
  +removeFavorite()
  +getLiked()
  +addLiked()
  +removeLiked()
  +getHistory()
  +upsertHistoryItem()
  +clearHistory()
  +removeHistoryItem()
  +uploadAvatar()
  +deleteAvatar()
  +getPhotoHistory()
  +updatePhotoHistory()
  +markEmailVerified()
}

class UsersPublicController {
  +validateEmail()
}

class UsersService {
  +upsertUser(uid, data)
  +updateUserProfile(uid, data)
  +getProfile(uid)
  +addFavorite(uid, item)
  +removeFavorite(uid, itemId)
  +getFavorites(uid)
  +addLiked(uid, itemId)
  +removeLiked(uid, itemId)
  +getLiked(uid)
  +upsertHistoryItem(uid, item)
  +removeHistoryItem(uid, itemId)
  +clearHistory(uid)
  +getHistory(uid)
  +getPhotoHistory(uid)
  +updatePhotoHistory(uid, photos)
  +markEmailVerified(uid)
  +deleteUserAccount(uid)
}

class EmailValidationService {
  +validateForSignup(email)
}

class FirebaseService {
  +verifyIdToken(idToken)
  +auth
  +firestore
}

BooksController --> BooksService
BooksService --> GoogleBooksService
BooksService --> MangaDexService
BooksService --> CacheOrchestratorService
BooksService --> ImageCacheService
BooksService --> StatusService

UsersController --> UsersService
UsersPublicController --> EmailValidationService
UsersService --> FirebaseService
```

## 5. UML Class Diagram for Frontend Structure

```mermaid
flowchart LR
  Layout[Layout\ncomponent]
  HomePage[HomePage\ncomponent]
  SearchPage[SearchPage\ncomponent]
  CategoriesPage[CategoriesPage\ncomponent]
  MyListPage[MyListPage\ncomponent]
  AccountPage[AccountPage\ncomponent]

  Navbar[Navbar\ncomponent]
  HeroCarousel[HeroCarousel\ncomponent]
  ContinueReadingRow[ContinueReadingRow\ncomponent]
  TopTenRow[TopTenRow\ncomponent]
  BookRow[BookRow\ncomponent]
  MangaGrid[MangaGrid\ncomponent]
  BookDetailModal[BookDetailModal\ncomponent]
  MangaReader[MangaReader\ncomponent]
  LoginModal[LoginModal\ncomponent]
  AccountModal[AccountModal\ncomponent]
  AuthContext[AuthContext\ncomponent]
  ToastContext[ToastContext\ncomponent]
  ReadingHistoryLib[ReadingHistoryLib\ncomponent]
  UserCacheLib[UserCacheLib\ncomponent]
  ProxyRoute[ProxyRoute\ncomponent]
  ImgProxyRoute[ImgProxyRoute\ncomponent]

  Layout --> Navbar
  Layout --> AuthContext
  Layout --> ToastContext

  HomePage --> HeroCarousel
  HomePage --> ContinueReadingRow
  HomePage --> TopTenRow
  HomePage --> BookRow

  SearchPage --> MangaGrid
  CategoriesPage --> MangaGrid
  MyListPage --> MangaGrid

  HeroCarousel --> BookDetailModal
  BookRow --> BookDetailModal
  TopTenRow --> BookDetailModal
  ContinueReadingRow --> BookDetailModal
  MangaGrid --> BookDetailModal
  BookDetailModal --> MangaReader

  Navbar --> LoginModal
  Navbar --> AccountModal
  AccountModal --> AuthContext
  LoginModal --> AuthContext

  BookDetailModal --> ReadingHistoryLib
  AuthContext --> UserCacheLib
  AuthContext --> ProxyRoute
  HomePage --> ProxyRoute
  BookDetailModal --> ProxyRoute
  MangaReader --> ProxyRoute
  HeroCarousel --> ImgProxyRoute
  BookRow --> ImgProxyRoute
  MangaGrid --> ImgProxyRoute
```

## 6. UML Sequence Diagram: User Reads and Translates Manga

```mermaid
sequenceDiagram
actor User
participant FE as Next.js Frontend
participant Proxy as Next API Proxy
participant BE as NestJS Backend
participant BS as BooksService
participant Cache as Cache Layer
participant MD as MangaDex API
participant GM as Gemini API
participant MIT as Manga Image Translator

User->>FE: Open book detail
FE->>Proxy: GET /books/manga/{id}
Proxy->>BE: Forward request
BE->>BS: getMangaDetail(id)
BS->>Cache: check detail cache
alt cache hit
  Cache-->>BS: manga detail
else cache miss
  BS->>MD: fetch manga detail
  MD-->>BS: detail
  BS->>Cache: save detail
end
BS-->>BE: detail
BE-->>Proxy: JSON
Proxy-->>FE: JSON

User->>FE: Open chapter reader
FE->>Proxy: GET /books/chapters/{chapterId}/pages
Proxy->>BE: Forward request
BE->>BS: getMangaChapterPages(chapterId)
BS->>MD: fetch page URLs
MD-->>BS: page list
BS-->>BE: chapter pages
BE-->>Proxy: JSON
Proxy-->>FE: JSON

User->>FE: Translate current page
FE->>Proxy: POST /books/chapters/{chapterId}/pages/{pageIndex}/translate-patches
Proxy->>BE: Forward request
BE->>BS: translateMangaPagePatches()
BS->>Cache: check patch cache
alt patch cache hit
  Cache-->>BS: patches
else cache miss
  BS->>MIT: detect text and create translation patches
  MIT->>GM: translate extracted text
  GM-->>MIT: translated text
  MIT-->>BS: patch images
  BS->>Cache: save patches
end
BS-->>BE: patch data
BE-->>Proxy: JSON
Proxy-->>FE: JSON
FE-->>User: render translated overlay
```

## 7. UML Sequence Diagram: Authentication and Profile Sync

```mermaid
sequenceDiagram
actor User
participant FE as AuthContext
participant FB as Firebase Client SDK
participant Proxy as Next API Proxy
participant BE as NestJS Backend
participant UC as UsersController
participant US as UsersService
participant FS as FirebaseService
participant DB as Firestore

User->>FE: Sign in with Google or Email
FE->>FB: authenticate user
FB-->>FE: Firebase user and ID token
FE->>Proxy: POST /users/me with Authorization
Proxy->>BE: Forward request
BE->>UC: upsertMe()
UC->>US: upsertUser(uid, profile)
US->>FS: get firestore instance
FS->>DB: create or update user document
DB-->>FS: success
FS-->>US: success
US-->>UC: success
UC-->>BE: { ok: true }
BE-->>Proxy: response
Proxy-->>FE: response
FE-->>User: logged in state updated
```

## 8. UML Activity Diagram: Read and Translate Manga Flow

```mermaid
flowchart TD
  A([Start]) --> B[Open book detail]
  B --> C[Load manga detail and chapter list]
  C --> D{User selects chapter?}
  D -- No --> Z([End])
  D -- Yes --> E[Open manga reader]
  E --> F[Load chapter pages]
  F --> G{Translate page?}
  G -- No --> H[Read original page]
  H --> I{Next page or close?}
  I -- Next page --> G
  I -- Close --> Z
  G -- Yes --> J[Send translate request]
  J --> K{Cache hit?}
  K -- Yes --> L[Return cached patches]
  K -- No --> M[Call translation service]
  M --> N[Generate translated patches]
  N --> O[Save to cache]
  O --> L
  L --> P[Render translated overlay]
  P --> I
```

## 9. UML Deployment Diagram

```mermaid
flowchart LR
  ClientDevice[ClientDevice\nnode\nBrowser]
  FrontendServer[FrontendServer\nnode\nNext.js App Router\nReact 19 UI\nAPI Proxy Routes]
  BackendServer[BackendServer\nnode\nNestJS API Server\nREST Controllers\nSSE Status Stream]
  TranslationServer[TranslationServer\nnode\nPython Manga Image Translator]
  FirebaseCloud[(FirebaseCloud\ncloud\nFirebase Auth\nFirestore)]
  ExternalServices[(ExternalServices\ncloud\nGoogle Books API\nMangaDex API\nGemini API)]
  CacheNodes[(CacheNodes\nnode\nRedis\nJSON Cache Files\nImage Cache Files)]
  LocalStorage[(LocalStorage\nnode\nuploads/avatars\nuploads/patches\nuploads/translated)]

  ClientDevice -->|HTTPS| FrontendServer
  FrontendServer -->|internal HTTP| BackendServer
  BackendServer -->|local HTTP| TranslationServer
  BackendServer -->|Admin SDK| FirebaseCloud
  BackendServer -->|HTTPS| ExternalServices
  BackendServer -->|cache access| CacheNodes
  BackendServer -->|file read and write| LocalStorage
```

## 10. Report Summary

### System Overview

MangaDock เป็นระบบอ่านหนังสือและมังงะที่ใช้สถาปัตยกรรมแบบแยก frontend และ backend อย่างชัดเจน โดย frontend พัฒนาด้วย Next.js และ backend พัฒนาด้วย NestJS พร้อมเชื่อมต่อบริการภายนอกหลายตัว เช่น Firebase, Google Books, MangaDex, Gemini และบริการแปลภาพมังงะ

### Key Design Points

- Frontend ใช้ App Router และแยก UI เป็น reusable components
- Next API routes ทำหน้าที่ proxy เพื่อลดปัญหา CORS และทำให้ client ใช้ relative URL ได้
- Backend แบ่งตามโมดูลธุรกิจ ได้แก่ books, users, cache, firebase และ status
- BooksService เป็น service กลางที่รวม content retrieval, translation และ cache orchestration
- UsersService จัดการข้อมูลผู้ใช้บน Firestore และฟีเจอร์ favorites, liked, history, profile
- ระบบมี cache หลายชั้นเพื่อเพิ่ม performance และรองรับกรณี upstream service ล่มชั่วคราว

### Recommended Usage in Report

ใช้แผนภาพตามลำดับนี้:

1. Use Case Diagram เพื่ออธิบายขอบเขตระบบ
2. Component Diagram เพื่ออธิบายภาพรวมทั้งระบบ
3. Package or Module Diagram เพื่ออธิบายการแบ่งโมดูลของ backend
4. Class Diagram เพื่ออธิบายโครงสร้าง class และ service หลัก
5. Sequence Diagram เพื่ออธิบาย flow สำคัญของระบบ
6. Activity Diagram เพื่ออธิบายขั้นตอนการทำงาน
7. Deployment Diagram เพื่ออธิบายการติดตั้งและการเชื่อมต่อบริการ

### If You Need Strict UML Notation

ถ้าต้องการ notation ให้เหมือนในหนังสือเรียนหรือรูปตัวอย่างแบบเป๊ะที่สุด แนะนำให้นำโครงจากไฟล์นี้ไปวาดต่อในเครื่องมือที่รองรับ UML โดยตรง เช่น:

1. StarUML
2. draw.io
3. Lucidchart
4. Visual Paradigm

Mermaid เหมาะมากสำหรับการทำเอกสารในโปรเจกต์และแก้ไขเร็ว แต่บาง diagram เช่น Use Case จะไม่เหมือน UML textbook แบบ 100%

หมายเหตุ:

- เนื้อหาสำหรับ Paper หัวข้อ `Phase 4: Internal Documentation and Versioning Control` ถูกแยกออกไปไว้ในไฟล์ [SE_PHASE4_INTERNAL_DOCUMENTATION.md](SE_PHASE4_INTERNAL_DOCUMENTATION.md) เพื่อให้ `UML_REPORT.md` โฟกัสเฉพาะแผนภาพ UML และไม่ปะปนกับเนื้อหาเชิงรายงาน