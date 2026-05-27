-- ⚠️  DEV ONLY — DO NOT RUN IN PRODUCTION
-- MangaDock Forum Mockup Data
-- Run this in Supabase SQL Editor to populate the community forum for local development.

-- 1. Create a dummy system/admin profile if it doesn't exist
INSERT INTO profiles (uid, display_name, photo_url, role, bio)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MangaDock Official', 'https://api.dicebear.com/7.x/bottts/svg?seed=admin', 'admin', 'Official System Account'),
  ('00000000-0000-0000-0000-000000000002', 'Slow-Inc Translator', 'https://api.dicebear.com/7.x/avataaars/svg?seed=translator', 'translator', 'ทีมงานแปลคุณภาพสูง'),
  ('00000000-0000-0000-0000-000000000003', 'MangaFan99', 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1', 'user', 'ชอบอ่านมังงะแนวต่างโลกครับ')
ON CONFLICT (uid) DO NOTHING;

-- 2. Add some Mock Posts (Using valid UUID hex format)
INSERT INTO forum_posts (id, author_uid, title, content, category, upvotes, downvotes)
VALUES 
  (
    'f07ade96-1234-4567-89ab-000000000001', 
    '00000000-0000-0000-0000-000000000001', 
    'ยินดีต้อนรับสู่ MangaDock Community!', 
    'พื้นที่สำหรับพูดคุย แลกเปลี่ยน และอัปเดตข่าวสารมังงะที่คุณรัก ขอให้สนุกกับการใช้งานครับ!', 
    'announcement',
    25, 0
  ),
  (
    'f07ade96-1234-4567-89ab-000000000002', 
    '00000000-0000-0000-0000-000000000002', 
    'อัปเดตงานแปล: Solo Leveling ตอนที่ 200', 
    'ตอนล่าสุดแปลไทยเสร็จเรียบร้อยแล้วนะครับ สามารถเข้าไปอ่านได้ที่หน้าอ่านมังงะได้เลยครับ ขอบคุณที่ติดตามครับ', 
    'manga_update',
    42, 2
  ),
  (
    'f07ade96-1234-4567-89ab-000000000003', 
    '00000000-0000-0000-0000-000000000003', 
    'มีใครอ่าน Oshi no Ko ตอนล่าสุดหรือยัง? (ระวังสปอยล์)', 
    'โห... เนื้อหาตอนนี้บีบหัวใจมากครับ ไม่คิดว่าอาจารย์จะเขียนออกมาแบบนี้ ทุกคนคิดว่าไงกันบ้าง?', 
    'spoiler',
    15, 5
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Add Mock Nested Comments for Post 3
INSERT INTO forum_comments (id, post_id, parent_id, author_uid, content, upvotes)
VALUES 
  (
    'c0ffee00-1234-4567-89ab-000000000001',
    'f07ade96-1234-4567-89ab-000000000003',
    NULL,
    '00000000-0000-0000-0000-000000000002',
    'เห็นด้วยครับ งานภาพตอนท้ายคือสื่ออารมณ์ได้สุดมาก',
    10
  ),
  (
    'c0ffee00-1234-4567-89ab-000000000002',
    'f07ade96-1234-4567-89ab-000000000003',
    'c0ffee00-1234-4567-89ab-000000000001',
    '00000000-0000-0000-0000-000000000003',
    'นั่นดิครับ ผมนี่ซึมไปเลย 3 วัน',
    5
  ),
  (
    'c0ffee00-1234-4567-89ab-000000000003',
    'f07ade96-1234-4567-89ab-000000000003',
    'c0ffee00-1234-4567-89ab-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'รอดูตอนต่อไปเลยครับ น่าจะมีจุดหักมุมอีกแน่นอน',
    3
  ),
  (
    'c0ffee00-1234-4567-89ab-000000000004',
    'f07ade96-1234-4567-89ab-000000000003',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    'แอดมินแนะนำให้ทำใจร่มๆ นะครับ 555 เดี๋ยวก็มีตอนใหม่มาเยียวยา',
    8
  )
ON CONFLICT (id) DO NOTHING;
