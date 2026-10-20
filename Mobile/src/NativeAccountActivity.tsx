import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { createAccountActivity } from "./account-activity.ts";
import {
  notificationDestination,
  type NotificationDestination,
} from "./notification-links.ts";
import { design } from "./design.ts";
export type ActivityScreen = "checkin" | "notifications" | "wallet";
export function NativeAccountActivity({
  activity,
  screen,
  onClose,
  onDestination,
  onBalanceChanged,
}: {
  activity: ReturnType<typeof createAccountActivity>;
  screen: ActivityScreen;
  onClose(): void;
  onDestination(destination: NotificationDestination): boolean;
  onBalanceChanged?(): void;
}) {
  const state = useSyncExternalStore(activity.subscribe, activity.snapshot);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const pending = useRef(false),
    active = useRef(true);
  const [walletTab, setWalletTab] = useState("analytics"),
    [month, setMonth] = useState(new Date().getMonth()),
    [year, setYear] = useState(new Date().getFullYear());
  const reload = () =>
    screen === "checkin"
      ? activity.checkin()
      : screen === "notifications"
        ? activity.notifications()
        : activity.wallet();
  useEffect(() => {
    active.current = true;
    void reload();
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") void reload();
    });
    return () => {
      active.current = false;
      listener.remove();
    };
  }, [activity, screen]);
  async function run(work: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error ? failure.message : "ทำรายการไม่สำเร็จ",
        );
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  const button = (label: string, work: () => void, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={work}
      disabled={disabled}
      style={[styles.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
  const labels = {
    checkin: "เช็กอินรายวัน",
    notifications: "การแจ้งเตือน",
    wallet: "ประวัติเหรียญ",
  };
  const resource =
    screen === "checkin"
      ? state.checkin
      : screen === "notifications"
        ? state.notifications
        : state.transactions;
  const transactions = state.transactions.items;
  const monthly = transactions.filter((item) => {
    const date = new Date(item.createdAt);
    return date.getMonth() === month && date.getFullYear() === year;
  });
  const income = monthly
    .filter((item) => ["topup", "reward", "refund"].includes(item.type))
    .reduce((sum, item) => sum + item.amount, 0);
  const spending = monthly
    .filter((item) => item.type === "purchase")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const rows =
    walletTab === "income"
      ? transactions.filter((item) =>
          ["topup", "reward", "refund"].includes(item.type),
        )
      : walletTab === "spending"
        ? transactions.filter((item) => item.type === "purchase")
        : monthly;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.row}>
            <Text style={styles.heading}>{labels[screen]}</Text>
            {button("ปิด", onClose)}
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {resource.loading && <ActivityIndicator color={design.primary} />}
            {(resource.error || error) && (
              <>
                <Text accessibilityRole="alert" style={styles.error}>
                  {resource.error || error}
                </Text>
                {button("ลองใหม่", () => void reload(), resource.loading)}
              </>
            )}
            {screen === "checkin" && state.checkin.data && (
              <>
                <Text style={styles.reward}>
                  🪙 {state.checkin.data.coinsToday} เหรียญ
                </Text>
                <Text style={styles.text}>
                  เช็กอินต่อเนื่อง {state.checkin.data.streakDay} วัน
                </Text>
                <View style={styles.row}>
                  {[1, 3, 7, 14, 30].map((day) => (
                    <View
                      key={day}
                      style={[
                        styles.milestone,
                        state.checkin.data!.streakDay >= day && {
                          borderColor: design.amber,
                        },
                      ]}
                    >
                      <Text style={styles.text}>{day} วัน</Text>
                    </View>
                  ))}
                </View>
                {state.checkin.data.checkedInToday ? (
                  <Text style={styles.success}>รับรางวัลวันนี้แล้ว</Text>
                ) : (
                  button(
                    "รับรางวัล",
                    () =>
                      void run(async () => {
                        try {
                          await activity.claim();
                        } finally {
                          onBalanceChanged?.();
                        }
                      }),
                    busy || resource.loading,
                  )
                )}
                <Text style={styles.muted}>
                  สถานะและวันเช็กอินอ้างอิงจากเซิร์ฟเวอร์
                </Text>
              </>
            )}
            {screen === "notifications" && (
              <>
                {button(
                  "อ่านทั้งหมด",
                  () => void run(() => activity.readNotification()),
                  busy || !state.notifications.unread,
                )}
                {!resource.loading &&
                  !resource.error &&
                  !state.notifications.items.length && (
                    <Text style={styles.muted}>ยังไม่มีการแจ้งเตือน</Text>
                  )}
                {state.notifications.items.map((item) => (
                  <Pressable
                    key={item.id}
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        if (
                          !item.read &&
                          !(await activity.readNotification(item.id))
                        )
                          return;
                        if (!active.current || !item.link) return;
                        const destination = notificationDestination(item.link);
                        if (!destination || !onDestination(destination))
                          throw new Error("หน้านี้ยังไม่รองรับในแอป");
                        onClose();
                      })
                    }
                    style={[
                      styles.card,
                      !item.read && {
                        borderColor: design.primary,
                        backgroundColor: "#6366f110",
                      },
                    ]}
                  >
                    <Text style={styles.heading}>
                      {!item.read ? "● " : ""}
                      {item.title}
                    </Text>
                    <Text style={styles.text}>{item.body}</Text>
                    <Text style={styles.muted}>
                      {new Date(item.createdAt).toLocaleString("th-TH")}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}
            {screen === "wallet" && (
              <>
                <Text style={styles.reward}>
                  {state.balance?.toLocaleString("th-TH") ?? "…"} เหรียญ
                </Text>
                <View style={styles.row}>
                  {[
                    ["analytics", "ภาพรวม"],
                    ["income", "รายรับ"],
                    ["spending", "รายจ่าย"],
                  ].map(([tab, label]) =>
                    button(`${walletTab === tab ? "● " : ""}${label}`, () =>
                      setWalletTab(tab),
                    ),
                  )}
                </View>
                {walletTab === "analytics" && (
                  <>
                    <View style={styles.row}>
                      {button("เดือนก่อน", () => {
                        if (!month) {
                          setYear(year - 1);
                          setMonth(11);
                        } else setMonth(month - 1);
                      })}
                      <Text style={styles.text}>
                        {new Date(year, month).toLocaleDateString("th-TH", {
                          month: "long",
                          year: "numeric",
                        })}
                      </Text>
                      {button("เดือนถัดไป", () => {
                        if (month === 11) {
                          setYear(year + 1);
                          setMonth(0);
                        } else setMonth(month + 1);
                      })}
                    </View>
                    <View style={styles.row}>
                      <View style={styles.card}>
                        <Text style={styles.muted}>รายรับ</Text>
                        <Text style={styles.success}>+{income}</Text>
                      </View>
                      <View style={styles.card}>
                        <Text style={styles.muted}>รายจ่าย</Text>
                        <Text style={styles.error}>−{spending}</Text>
                      </View>
                    </View>
                  </>
                )}
                <Text style={styles.muted}>
                  ข้อมูลรายการล่าสุดสูงสุด 50 รายการ
                </Text>
                {!resource.loading && !resource.error && !rows.length && (
                  <Text style={styles.muted}>ยังไม่มีรายการในช่วงนี้</Text>
                )}
                {rows.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.row}>
                      <Text style={styles.heading}>
                        {(
                          {
                            topup: "เติมเงิน",
                            purchase: "ซื้อ",
                            refund: "คืนเงิน",
                            reward: "รางวัล",
                          } as Record<string, string>
                        )[item.type] ?? item.type}
                      </Text>
                      <Text
                        style={item.amount < 0 ? styles.error : styles.success}
                      >
                        {item.amount > 0 ? "+" : ""}
                        {item.amount} เหรียญ
                      </Text>
                    </View>
                    <Text style={styles.text}>{item.description}</Text>
                    <Text style={styles.muted}>
                      {new Date(item.createdAt).toLocaleString("th-TH")} ·
                      คงเหลือ {item.balanceAfter}
                    </Text>
                  </View>
                ))}
                {button(
                  "รีเฟรช",
                  () => void activity.wallet(),
                  resource.loading,
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.7)",
  },
  sheet: {
    maxHeight: "90%",
    backgroundColor: design.sheet,
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 16,
  },
  content: { gap: 16, paddingBottom: 20 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  text: { color: design.foreground },
  heading: { color: design.foreground, fontWeight: "700", fontSize: 17 },
  muted: { color: design.muted, fontSize: 12 },
  error: { color: design.error },
  success: { color: design.success },
  reward: {
    color: design.amber,
    fontWeight: "800",
    fontSize: 30,
    textAlign: "center",
  },
  button: {
    padding: 12,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 12,
    backgroundColor: design.tint,
  },
  card: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: design.border,
    backgroundColor: design.tint,
  },
  milestone: {
    padding: 10,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 10,
  },
});
