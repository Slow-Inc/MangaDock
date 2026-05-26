"use client";

import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useToast } from "../contexts/ToastContext";
import { becomeTranslator } from "../lib/studioApi";

/**
 * StudioLayout handles global access control for all /studio/* routes.
 * 
 * RBAC Logic:
 * 1. Unauthenticated -> Redirect to "/"
 * 2. Authenticated + role: 'user' -> Show Onboarding Screen
 * 3. Authenticated + role: 'translator'|'creator'|'admin' -> Show Dashboard
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, userRole, getIdToken, refreshSession } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [upgrading, setUpgrading] = useState(false);

  // 1. Handle Unauthenticated Redirect
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  const handleBecomeCreator = async () => {
    setUpgrading(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication token not found");
      
      await becomeTranslator(token);
      showToast({ 
        type: "success", 
        message: "ยินดีด้วย! คุณได้เป็น Creator แล้ว ระบบกำลังอัปเดตสิทธิ์การเข้าถึง...", 
        duration: 5000 
      });
      
      // Refresh session to get new role from JWT
      await refreshSession();
    } catch (err: any) {
      showToast({ type: "error", message: `ไม่สามารถอัปเกรดบัญชีได้: ${err.message}` });
    } finally {
      setUpgrading(false);
    }
  };

  // 2. Loading State
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!user) return null;

  // 3. RBAC Enforcement: Onboarding for regular 'user' role
  const isAuthorized = userRole === "translator" || userRole === "creator" || userRole === "admin";

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white">
        <Navbar />
        
        <main className="pt-32 pb-20 px-4 max-w-4xl mx-auto text-center">
          {/* Onboarding Header with Liquid Glass effect */}
          <div className="relative p-10 rounded-[2.5rem] border border-white/10 bg-white/2 backdrop-blur-xl overflow-hidden mb-12 animate-in fade-in zoom-in-95 duration-700">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_50%)]" />
            
            <span className="relative inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">
              Welcome to MangaDock Studio
            </span>
            
            <h1 className="relative text-4xl sm:text-5xl font-black mb-6 leading-tight tracking-tighter">
              เริ่มต้นเส้นทาง <br/><span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-violet-400">Content Creator</span> ของคุณ
            </h1>
            
            <p className="relative text-white/50 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
              สตูดิโอคือพื้นที่สำหรับนักแปลและนักเขียนที่ต้องการแบ่งปันผลงานมังงะคุณภาพสูง อัปโหลดงานของคุณ สร้างฐานแฟนคลับ และรับรางวัลจากผู้อ่านได้ทันที
            </p>

            <button
              onClick={handleBecomeCreator}
              disabled={upgrading}
              className="relative group px-10 py-4 rounded-2xl bg-indigo-600 text-white font-black text-lg hover:bg-indigo-500 active:scale-95 smooth-hover shadow-2xl shadow-indigo-500/30 disabled:opacity-50"
            >
              {upgrading ? "กำลังเตรียมพื้นที่สตูดิโอ..." : "สมัครเป็นนักแปล / Creator"}
              <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </button>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="group p-8 rounded-[2rem] border border-white/5 bg-white/2 backdrop-blur-md smooth-hover hover:border-indigo-500/30 hover:bg-white/4 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-indigo-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <svg className="w-7 h-7 text-indigo-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="font-black text-white text-xl mb-3 tracking-tight">อัปโหลดผลงาน</h3>
              <p className="text-sm text-white/40 leading-relaxed font-medium">แชร์มังงะที่คุณแปล หรือผลงานที่คุณวาดเองให้กับสมาชิก MangaDock ทั่วโลก พร้อมระบบจัดการไฟล์ระดับโปร</p>
            </div>

            <div className="group p-8 rounded-[2rem] border border-white/5 bg-white/2 backdrop-blur-md smooth-hover hover:border-amber-500/30 hover:bg-white/4 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-amber-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <svg className="w-7 h-7 text-amber-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-black text-white text-xl mb-3 tracking-tight">สร้างรายได้</h3>
              <p className="text-sm text-white/40 leading-relaxed font-medium">ตั้งราคาตอนของมังงะเพื่อรับรายได้เป็นเหรียญจากผู้อ่านโดยตรง เปลี่ยนความชอบให้เป็นอาชีพที่มั่นคง</p>
            </div>

            <div className="group p-8 rounded-[2rem] border border-white/5 bg-white/2 backdrop-blur-md smooth-hover hover:border-emerald-500/30 hover:bg-white/4 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <svg className="w-7 h-7 text-emerald-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2zm10 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
              </div>
              <h3 className="font-black text-white text-xl mb-3 tracking-tight">วิเคราะห์ข้อมูล</h3>
              <p className="text-sm text-white/40 leading-relaxed font-medium">เข้าถึง Dashboard ระดับสูงเพื่อดูสถิติการอ่าน ยอดเหรียญสะสม และแนวโน้มความนิยมแบบเรียลไทม์</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 4. Authorized Access
  return <div className="min-h-dvh bg-[#141414]">{children}</div>;
}
