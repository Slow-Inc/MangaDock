# MangaDock UML Report

เอกสารนี้รวบรวมแผนภาพ UML หลักของโปรเจกต์ MangaDock สำหรับใช้ในรายงานและการนำเสนอวิชา Software Engineering (อัปเดต Phase 1.5)

---

## 1. UML Use Case Diagram

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
  UC11([Verify Captcha])

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

  UC4 -. include .-> UC11
  UC5 -. extend .-> UC4
```

## 2. UML Component Diagram (Phase 1.5 Optimized)

```mermaid
flowchart LR
  User([User\nactor])

  NextFrontend[NextFrontend\ncomponent\nReact 19 / Next.js 16\nCentralized Image Resolver\nSupabase Guard\nHardware Fingerprinting]
  NestBackend[NestBackend\ncomponent\nNestJS 11\nStructured Logging\nStorage Adapter\nAsync Webhook Controller]

  BooksService[BooksService\nservice]
  UsersService[UsersService\nservice]
  CacheOrchestrator[CacheOrchestrator\nservice]
  SupabaseService[SupabaseService\nservice]
  StorageProvider[StorageProvider\ninterface]

  GoogleBooksAPI[(Google Books API\nexternal)]
  MangaDexAPI[(MangaDex API\nexternal)]
  GeminiAPI[(Gemini API\nexternal)]
  MITServer[(MIT Server\nFastAPI / Async)]
  Supabase[(Supabase\nAuth / DB)]
  Redis[(Redis\nDistributed Cache)]
  LocalStorage[(LocalStorage\nUploads / Patches)]

  User -->|HTTPS| NextFrontend
  NextFrontend -->|relative HTTP\nwith x-hardware-id| NestBackend
  NextFrontend <-->|Auth / Direct Data| Supabase

  NestBackend --> BooksService
  NestBackend --> UsersService
  NestBackend --> CacheOrchestrator

  BooksService -->|Metadata| GoogleBooksAPI
  BooksService -->|Manga Content| MangaDexAPI
  BooksService -->|Translation| GeminiAPI
  BooksService -->|Async Tasks| MITServer
  
  UsersService --> SupabaseService
  SupabaseService <--> Supabase

  CacheOrchestrator <--> Redis
  
  BooksService --> StorageProvider
  UsersService --> StorageProvider
  StorageProvider <--> LocalStorage
```

## 3. UML Package Diagram (Backend)

```mermaid
classDiagram
direction TB

class AppModule {
  +imports StorageModule
  +imports CacheModule
  +imports SupabaseModule
  +imports BooksModule
}

class StorageModule {
  +StorageProvider (Interface)
  +DiskStorageProvider
}

class CacheModule {
  +CacheOrchestratorService
  +RedisService
  +JsonCacheService
  +ImageCacheService
}

class BooksModule {
  +BooksController
  +MitWebhookController
  +BooksService
}

AppModule --> StorageModule
AppModule --> CacheModule
AppModule --> BooksModule
BooksModule --> StorageModule
BooksModule --> CacheModule
```

## 4. UML Class Diagram (Core Services)

```mermaid
classDiagram
direction TB

class StorageProvider {
  <<interface>>
  +put(key, data)
  +get(key)
  +delete(key)
  +exists(key)
  +list(prefix)
  +deleteDir(prefix)
}

class BooksService {
  -activeBatchJobs: Map
  +getLandingBooks()
  +translateMangaPagePatches()
  +startOrAttachBatchJob()
  +handleMitCallback(taskId, result)
}

class MitWebhookController {
  +handleCallback(signature, body)
}

class AllExceptionsFilter {
  +catch(exception, host)
}

class StructuredLoggingInterceptor {
  +intercept(context, next)
}

BooksService ..> StorageProvider : uses
MitWebhookController --> BooksService : notifies
```

## 5. UML Sequence Diagram: Async Manga Translation (T4-Standard)

```mermaid
sequenceDiagram
actor User
participant FE as Next.js Frontend
participant BE as NestJS Backend
participant BS as BooksService
participant MIT as MIT Server (Python)

User->>FE: Request Translation
FE->>BE: POST /batch-translate-patches (with x-hardware-id)
BE->>BS: startOrAttachBatchJob()
BS->>MIT: POST /patches/batch (taskId, callback_url)
MIT-->>BS: 202 Accepted (Non-blocking)
BS-->>BE: Job Started
BE-->>FE: SSE Stream Initialized

Note over MIT: Processing AI Pipeline...

MIT->>BE: POST /webhooks/mit/callback (taskId, patches, HMAC)
BE->>BS: handleMitCallback(taskId, patches)
BS->>BS: Save Patches via StorageProvider
BS->>FE: SSE Push (pageIndex, patchUrls)
FE-->>User: Render Translated Overlay
```

## 6. UML Deployment Diagram (Phase 1.5 Readiness)

```mermaid
flowchart LR
  Browser[User Browser]
  
  subgraph Local/VPS
    FE[Frontend Container\nNext.js 16]
    BE[Backend Container\nNestJS 11]
    MIT[AI Server Container\nPython / FastAPI]
    Redis[(Redis Container)]
    Disk[(Local Storage\n/uploads)]
  end

  subgraph Cloud_Services
    SupabaseCloud[(Supabase\nAuth / PostgreSQL)]
    Gemini[(Gemini API)]
  end

  Browser -->|HTTPS| FE
  FE -->|HTTP| BE
  BE -->|HTTP| MIT
  BE <--> Redis
  BE <--> Disk
  BE <--> SupabaseCloud
  MIT <--> Gemini
  MIT -->|Webhook| BE
```

---

*แผนภาพ UML ชุดนี้สะท้อนโครงสร้างระบบที่มีความยืดหยุ่น (Decoupled) และพร้อมสำหรับการย้ายเข้าสู่ระบบ Cloud / Cloudflare ใน Phase ถัดไป*
