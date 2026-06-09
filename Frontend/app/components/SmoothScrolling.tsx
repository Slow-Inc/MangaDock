'use client';

import { ReactLenis } from 'lenis/react';
import type { LenisRef } from 'lenis/react';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef } from 'react';

interface SmoothScrollingProps {
  children: ReactNode;
}

export default function SmoothScrolling({ children }: SmoothScrollingProps) {
  // การตั้งค่าความหนืดและแรงต้าน (Inertia & Resistance)
  // - lerp: ค่าน้อยๆ จะทำให้มีความหนืดมากขึ้น (ความรู้สึกเหมือนน้ำหนักตัวเยอะ)
  // - wheelMultiplier: ความไวของลูกกลิ้งเมาส์ ค่าน้อยจะต้านมือหน่อยๆ
  // - smoothWheel: เปิดเพื่อให้ scroll ล้อเมาส์มีความนุ่ม

  const lenisRef = useRef<LenisRef | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    lenisRef.current?.lenis?.scrollTo(0, { immediate: true });
  }, [pathname]);

  useEffect(() => {
    let resizeFrame = 0;
    let initialFrameA = 0;
    let initialFrameB = 0;
    let timer = 0;

    const scheduleResize = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        lenisRef.current?.lenis?.resize?.();
      });
    };

    initialFrameA = requestAnimationFrame(() => {
      scheduleResize();
      initialFrameB = requestAnimationFrame(scheduleResize);
    });
    timer = window.setTimeout(scheduleResize, 180);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleResize();
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(document.documentElement);
      resizeObserver.observe(document.body);
    }

    const onWindowResize = () => scheduleResize();
    window.addEventListener('pageshow', onWindowResize);
    window.addEventListener('resize', onWindowResize);

    void document.fonts?.ready?.then(() => {
      scheduleResize();
    });

    return () => {
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(initialFrameA);
      cancelAnimationFrame(initialFrameB);
      window.clearTimeout(timer);
      resizeObserver?.disconnect();
      window.removeEventListener('pageshow', onWindowResize);
      window.removeEventListener('resize', onWindowResize);
    };
  }, [pathname]);

  // Docs page uses h-screen with inner overflow-y-auto panels — Lenis root
  // intercepts wheel events at the document level and prevents native scroll.
  if (pathname.startsWith('/docs')) {
    return <>{children}</>;
  }

  return (
    <ReactLenis
      ref={lenisRef}
      root
      options={{
        lerp: 0.08, // ยิ่งน้อยยิ่งรู้สึกหนืดและมีแรงต้าน (ค่าปกติคือ ~0.1)
        wheelMultiplier: 1, // ลดความไวลูกกลิ้งเล็กน้อยให้รู้สึกหนัก
        smoothWheel: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
