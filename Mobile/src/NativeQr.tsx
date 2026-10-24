import React, { useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import { createNativeQr } from "./qr.ts";
export function NativeQr({
  payload,
  label = "QR เติมเงิน",
}: {
  payload: string;
  label?: string;
}) {
  const { width } = useWindowDimensions();
  const size = Math.min(280, width - 88);
  const qr = useMemo(() => createNativeQr(payload, size), [payload, size]);
  return (
    <View
      accessibilityLabel={label}
      style={{
        width: qr.size,
        height: qr.size,
        backgroundColor: "#fff",
        alignSelf: "center",
      }}
    >
      {qr.rects.map((rect, index) => (
        <View
          key={index}
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            backgroundColor: "#000",
          }}
        />
      ))}
    </View>
  );
}
