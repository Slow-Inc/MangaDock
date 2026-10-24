import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
export function NativeBanner({
  uri,
  position,
}: {
  uri: string;
  position: number;
}) {
  const [width, setWidth] = useState(0),
    [ratio, setRatio] = useState(1);
  useEffect(() => {
    let active = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (active && w > 0) setRatio(h / w);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [uri]);
  const height = Math.max(160, width * ratio);
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: 160, borderRadius: 16, overflow: "hidden" }}
    >
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={{
          width: "100%",
          height,
          top: (-(height - 160) * Math.min(100, Math.max(0, position))) / 100,
        }}
      />
    </View>
  );
}
