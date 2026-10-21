import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { createWallet } from "./wallet.ts";
import type { PaymentContext } from "./wallet.ts";
import { NativeQr } from "./NativeQr.tsx";
import { design } from "./design.ts";
import { NativeIcon, NativeTopBar } from "./NativeDesign.tsx";

export function NativeWalletView({
  wallet,
  onBack,
  context,
  onHistory,
}: {
  wallet: ReturnType<typeof createWallet>;
  onBack(): void;
  context?: PaymentContext;
  onHistory?(): void;
}) {
  const state = useSyncExternalStore(wallet.subscribe, wallet.snapshot);
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "ตรวจสอบการเติมเงินไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let mounted = true;
    const recover = async () => {
      try {
        await wallet.restore();
        await wallet.refresh();
      } catch (failure) {
        if (mounted)
          setError(
            failure instanceof Error
              ? failure.message
              : "ตรวจสอบการเติมเงินไม่สำเร็จ",
          );
      }
    };
    void recover();
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") void recover();
      else wallet.stopWatching();
    });
    return () => {
      mounted = false;
      listener.remove();
      wallet.stopWatching();
    };
  }, [wallet]);
  useEffect(() => {
    if (state.payment?.status !== "pending") return;
    let mounted = true;
    const watch = () => {
      if (AppState.currentState === "active")
        void wallet.watch().catch(() => {
          if (mounted) setError("การเชื่อมต่อขาดหาย กดตรวจสอบสถานะได้");
        });
    };
    watch();
    const interval = setInterval(() => {
      setNow(Date.now());
      if (AppState.currentState === "active") {
        void wallet.reconcile().catch(() => {});
        watch();
      }
    }, 15000);
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") watch();
      else wallet.stopWatching();
    });
    return () => {
      mounted = false;
      clearInterval(interval);
      listener.remove();
      wallet.stopWatching();
    };
  }, [wallet, state.payment?.paymentId, state.payment?.status]);
  const button = (
    label: string,
    action: () => void,
    disabled = false,
    primary = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={[
        styles.button,
        primary && styles.primaryButton,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.buttonText, primary && { color: "#111116" }]}>
        {label}
      </Text>
    </Pressable>
  );
  const payment = state.payment;
  return (
    <View style={styles.root}>
      <NativeTopBar onBack={onBack} />
      {onHistory && button("ประวัติเหรียญ", onHistory)}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.caption}>ยอดเหรียญปัจจุบัน</Text>
            <Text style={styles.balance}>
              {state.balance?.toLocaleString("th-TH") ?? "…"}
            </Text>
          </View>
          <NativeIcon name="coins" color={design.amberText} size={32} />
        </View>
        <View style={styles.panel}>
          <Text style={styles.title}>
            {payment?.status === "pending"
              ? "สแกน QR เพื่อชำระเงิน"
              : "เติมเหรียญ"}
          </Text>
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {payment?.status === "pending" ? (
            <>
              <Text style={styles.caption}>
                เติม {payment.amount.toLocaleString("th-TH")} เหรียญ
              </Text>
              {Date.parse(payment.expiresAt) > now ? (
                <View style={styles.qr}>
                  <NativeQr payload={payment.qrString} />
                </View>
              ) : (
                <Text style={styles.caption}>
                  QR ถึงเวลาหมดอายุแล้ว กำลังตรวจสอบสถานะกับบริการ
                </Text>
              )}
              <Text style={styles.caption}>
                ใช้แอปธนาคารสแกน QR จากอุปกรณ์อีกเครื่อง
                หรือใช้ภาพหน้าจอตามที่แอปธนาคารรองรับ
                เมื่อกลับมาแอปจะตรวจสอบรายการเดิม
              </Text>
              <Text style={styles.expiry}>
                ใช้ได้ถึง{" "}
                {new Date(payment.expiresAt).toLocaleTimeString("th-TH")}
              </Text>
              {button(
                "ตรวจสอบสถานะ",
                () => void run(() => wallet.reconcile()),
                busy,
              )}
              {button(
                "ยกเลิกรายการ",
                () => void run(() => wallet.cancel()),
                busy,
              )}
            </>
          ) : (
            <>
              {payment && (
                <Text
                  style={
                    payment.status === "paid" ? styles.success : styles.caption
                  }
                >
                  {payment.status === "paid"
                    ? "เติมเงินสำเร็จ ยอดเงินยืนยันจากบริการแล้ว"
                    : "รายการสิ้นสุดแล้ว สามารถสร้างรายการใหม่ได้"}
                </Text>
              )}
              <Text style={styles.caption}>เลือกจำนวนเหรียญที่ต้องการเติม</Text>
              <View style={styles.tiers}>
                {[20, 50, 100, 200, 500, 1000].map((tier) => (
                  <Pressable
                    key={tier}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: Number(amount) === tier,
                      disabled: busy,
                    }}
                    disabled={busy}
                    onPress={() => setAmount(String(tier))}
                    style={[
                      styles.tier,
                      Number(amount) === tier && styles.selectedTier,
                    ]}
                  >
                    <Text
                      style={
                        Number(amount) === tier
                          ? styles.tierActive
                          : styles.buttonText
                      }
                    >
                      {tier.toLocaleString("th-TH")}
                    </Text>
                    <Text style={styles.caption}>เหรียญ</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.caption}>
                หรือระบุจำนวนเอง (20–100,000 เหรียญ)
              </Text>
              <TextInput
                accessibilityLabel="จำนวนเหรียญที่เติม"
                keyboardType="number-pad"
                value={amount}
                onChangeText={setAmount}
                editable={!busy}
                style={styles.input}
              />
              {button(
                "สร้าง QR เติมเงิน",
                () =>
                  void run(async () => {
                    const value = Number(amount);
                    if (
                      !Number.isInteger(value) ||
                      value < 20 ||
                      value > 100000
                    )
                      throw new Error("กรุณาระบุจำนวนเต็ม 20–100,000");
                    await wallet.createTopup(value, context);
                  }),
                busy,
                true,
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  content: { padding: 16, gap: 20 },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 16,
    backgroundColor: design.amberTint,
    borderColor: "rgba(245,158,11,0.2)",
    borderWidth: 1,
  },
  balance: {
    color: design.amberText,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 4,
  },
  title: { color: design.foreground, fontSize: 18, fontWeight: "700" },
  panel: {
    padding: 20,
    gap: 16,
    backgroundColor: design.sheet,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: design.border,
  },
  caption: { color: design.muted, fontSize: 12, lineHeight: 20 },
  buttonText: {
    color: design.foreground,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  button: {
    minHeight: 48,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: design.tint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
  },
  primaryButton: { backgroundColor: design.amber, borderColor: design.amber },
  input: {
    color: design.foreground,
    fontSize: 16,
    borderWidth: 1,
    borderColor: design.border,
    backgroundColor: design.tint,
    borderRadius: 12,
    padding: 14,
  },
  tiers: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  tier: {
    width: "31%",
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
    backgroundColor: design.tint,
  },
  selectedTier: {
    borderColor: design.amber,
    backgroundColor: design.amberTint,
  },
  tierActive: { color: design.amberText, fontWeight: "700", fontSize: 16 },
  qr: {
    alignSelf: "center",
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  expiry: { color: design.amberText, textAlign: "center", fontSize: 14 },
  error: { color: design.error, lineHeight: 22 },
  success: { color: design.success, lineHeight: 22 },
});
