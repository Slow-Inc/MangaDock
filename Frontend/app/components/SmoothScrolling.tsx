'use client';

import { ReactLenis } from 'lenis/react';
import { ReactNode, useEffect, useRef } from 'react';

interface SmoothScrollingProps {
  children: ReactNode;
}

export default function SmoothScrolling({ children }: SmoothScrollingProps) {
  // การตั้งค่าความหนืดและแรงต้าน (Inertia & Resistance)
  // - lerp: ค่าน้อยๆ จะทำให้มีความหนืดมากขึ้น (ความรู้สึกเหมือนน้ำหนักตัวเยอะ)
  // - wheelMultiplier: ความไวของลูกกลิ้งเมาส์ ค่าน้อยจะต้านมือหน่อยๆ
  // - smoothWheel: เปิดเพื่อให้ scroll ล้อเมาส์มีความนุ่ม

  const lenisRef = useRef<any>(null);

  // Force-stop Lenis during HMR so it doesn't block the page refresh
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handler = (_data: any) => {
      lenisRef.current?.lenis?.stop();
    };

    if (typeof module !== 'undefined' && (module as any).hot) {
      (module as any).hot.dispose(handler);
    }
  }, []);

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
